// app/actions/onboard.ts
// ============================================================
// THE LONDON PROTOCOL — Onboarding Server Action
// 1. Validates the application
// 2. Writes to onboarding_applications in Supabase
// 3. Creates a Stripe Checkout Session
// 4. Redirects to Stripe
// ============================================================

'use server'

import { createClient } from '@supabase/supabase-js'
import { redirect }     from 'next/navigation'
import { z }            from 'zod'
import type { OnboardingState } from '@/types/onboard'

const STRIPE_PRICE_IDS: Record<string, string> = {
  core:  process.env.STRIPE_PRICE_CORE!,   // £299/mo
  plus:  process.env.STRIPE_PRICE_PLUS!,   // £599/mo
  elite: process.env.STRIPE_PRICE_ELITE!,  // £999/mo
}

const OnboardSchema = z.object({
  tier:             z.enum(['core', 'plus', 'elite']),
  name:             z.string().min(2).max(120),
  tagline:          z.string().max(200).optional(),
  borough:          z.string().min(2),
  postcode:         z.string().min(3).max(10),
  contactName:      z.string().min(2).max(120),
  contactEmail:     z.string().email(),
  contactPhone:     z.string().optional(),
  pastLife:         z.string().min(2),
  era:              z.string().optional(),
  heritage:         z.string().optional(),
  retainedFeatures: z.string().optional(),
  salvageStory:     z.string().optional(),
  vibe:             z.string().min(2),
  tags:             z.array(z.string()),
  rackRate:         z.string().min(1),
  protocolRate:     z.string().min(1),
})

export async function submitOnboarding(state: OnboardingState): Promise<never> {
  // 1. Validate
  const parsed = OnboardSchema.safeParse(state)
  if (!parsed.success) {
    console.error('[Onboard] Validation failed:', parsed.error.issues)
    redirect('/onboard?error=validation')
  }

  const data = parsed.data
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // 2. Generate application ref
  const applicationRef = `LP-APP-${Date.now().toString(36).toUpperCase()}`

  // 3. Write application to Supabase
  const { data: inserted, error: dbErr } = await supabase
    .from('onboarding_applications')
    .insert({
      application_ref:   applicationRef,
      tier:              data.tier,
      property_name:     data.name,
      property_tagline:  data.tagline,
      borough:           data.borough.toLowerCase().replace(/ /g, '_'),
      postcode:          data.postcode,
      contact_name:      data.contactName,
      contact_email:     data.contactEmail,
      contact_phone:     data.contactPhone,
      past_life:         data.pastLife.toLowerCase().replace(/ /g, '_'),
      era:               data.era,
      heritage_listing:  data.heritage,
      retained_features: data.retainedFeatures
        ? data.retainedFeatures.split(',').map(s => s.trim()).filter(Boolean)
        : [],
      salvage_story:     data.salvageStory,
      primary_vibe:      data.vibe,
      experience_tags:   data.tags,
      rack_rate:         parseFloat(data.rackRate),
      protocol_rate:     parseFloat(data.protocolRate),
      status:            'pending_payment',
    })
    .select('id')
    .single()

  if (dbErr || !inserted) {
    console.error('[Onboard] DB insert failed:', dbErr)
    redirect('/onboard?error=db')
  }

  // 4. Create Stripe Checkout Session
  const stripe = (await import('stripe')).default
  const client = new stripe(process.env.STRIPE_SECRET_KEY!)

  const session = await client.checkout.sessions.create({
    mode:            'subscription',
    payment_method_types: ['card'],
    line_items: [
      {
        price:    STRIPE_PRICE_IDS[data.tier],
        quantity: 1,
      },
    ],
    customer_email:  data.contactEmail,
    metadata: {
      applicationRef,
      applicationId: inserted.id,
      propertyName:  data.name,
      tier:          data.tier,
    },
    subscription_data: {
      metadata: {
        applicationRef,
        propertyName: data.name,
        tier:         data.tier,
      },
    },
    success_url: `${process.env.NEXT_PUBLIC_BASE_URL}/onboard/success?session_id={CHECKOUT_SESSION_ID}&ref=${applicationRef}`,
    cancel_url:  `${process.env.NEXT_PUBLIC_BASE_URL}/onboard?cancelled=1`,
    allow_promotion_codes: true,
    billing_address_collection: 'required',
    tax_id_collection: { enabled: true },   // hotels will need VAT
  })

  redirect(session.url!)
}


// ============================================================
// app/api/stripe/webhook/route.ts
// Stripe webhook — handles subscription events post-payment
// ============================================================

import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig  = req.headers.get('stripe-signature')!

  const stripe = (await import('stripe')).default
  const client = new stripe(process.env.STRIPE_SECRET_KEY!)

  let event: any
  try {
    event = client.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err) {
    console.error('[Webhook] Signature failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  if (event.type === 'checkout.session.completed') {
    const session    = event.data.object
    const appRef     = session.metadata?.applicationRef
    const appId      = session.metadata?.applicationId
    const tier       = session.metadata?.tier
    const propName   = session.metadata?.propertyName
    const customerId = session.customer as string
    const subId      = session.subscription as string

    if (!appRef) return NextResponse.json({ ok: true })

    // 1. Update application status
    await supabase
      .from('onboarding_applications')
      .update({
        status:            'payment_confirmed',
        stripe_customer:   customerId,
        stripe_session:    session.id,
        stripe_sub_id:     subId,
        payment_confirmed_at: new Date().toISOString(),
      })
      .eq('application_ref', appRef)

    // 2. Provision the property (create properties + hotel_accounts rows)
    await provisionProperty(supabase, { appId, appRef, tier, customerId, subId, propName })
  }

  if (event.type === 'customer.subscription.deleted') {
    const sub = event.data.object
    // Deactivate property when subscription cancels
    const { data: acct } = await supabase
      .from('hotel_accounts')
      .select('property_id')
      .eq('stripe_sub_id', sub.id)
      .single()

    if (acct?.property_id) {
      await supabase
        .from('properties')
        .update({ is_active: false })
        .eq('id', acct.property_id)
    }
  }

  if (event.type === 'invoice.payment_failed') {
    // Optional: send alert email to hotel
    console.warn('[Webhook] Payment failed for sub:', event.data.object.subscription)
  }

  return NextResponse.json({ ok: true })
}

async function provisionProperty(
  supabase: any,
  params: {
    appId:       string
    appRef:      string
    tier:        string
    customerId:  string
    subId:       string
    propName:    string
  }
) {
  // Fetch full application data
  const { data: app } = await supabase
    .from('onboarding_applications')
    .select('*')
    .eq('id', params.appId)
    .single()

  if (!app) return

  // Create the property record
  const { data: property, error: propErr } = await supabase
    .from('properties')
    .insert({
      name:              app.property_name,
      tagline:           app.property_tagline,
      borough:           app.borough,
      postcode:          app.postcode,
      protocol_nightly:  app.protocol_rate,
      rack_rate:         app.rack_rate,
      is_active:         false,    // goes live after editorial review
      is_verified:       false,
      slug:              slugify(app.property_name),
    })
    .select('id')
    .single()

  if (propErr || !property) {
    console.error('[Provision] Property insert failed:', propErr)
    return
  }

  const propertyId = property.id

  // Create hotel account
  await supabase.from('hotel_accounts').insert({
    property_id:     propertyId,
    contact_name:    app.contact_name,
    contact_email:   app.contact_email,
    tier:            `protocol_${params.tier}`,
    stripe_customer: params.customerId,
    stripe_sub_id:   params.subId,
    billing_active:  true,
  })

  // Seed past_lives from application
  if (app.past_life) {
    await supabase.from('past_lives').insert({
      property_id:          propertyId,
      former_use:           app.past_life,
      era:                  app.era,
      heritage_listing:     app.heritage_listing,
      retained_features:    app.retained_features ?? [],
      salvage_story:        app.salvage_story,
      salvaged_stay_score:  null,    // set after editorial inspection
    })
  }

  // Seed vibe_metrics
  if (app.primary_vibe) {
    await supabase.from('vibe_metrics').insert({
      property_id: propertyId,
      vibe:        app.primary_vibe,
      score:       50,    // default — elevated after inspection
    })
  }

  // Seed experience tags
  if (app.experience_tags?.length) {
    // Look up tag IDs
    const { data: tagRows } = await supabase
      .from('experience_tags')
      .select('id, tag')
      .in('tag', app.experience_tags)

    if (tagRows?.length) {
      await supabase.from('property_tags').insert(
        tagRows.map((t: any) => ({ property_id: propertyId, tag_id: t.id }))
      )
    }
  }

  // Mark application as fully provisioned
  await supabase
    .from('onboarding_applications')
    .update({ status: 'provisioned', property_id: propertyId })
    .eq('id', params.appId)
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 80)
}


// ============================================================
// types/onboard.ts — TypeScript types for onboarding
// ============================================================

export interface OnboardingState {
  tier:             'core' | 'plus' | 'elite'
  name:             string
  tagline:          string
  borough:          string
  postcode:         string
  contactName:      string
  contactEmail:     string
  contactPhone:     string
  pastLife:         string
  era:              string
  heritage:         string
  retainedFeatures: string
  salvageStory:     string
  vibe:             string
  tags:             string[]
  rackRate:         string
  protocolRate:     string
}

export interface StepProps {
  state:       OnboardingState
  update:      (patch: Partial<OnboardingState>) => void
  next:        () => void
  prev:        () => void
  currentStep: number
  totalSteps:  number
}

// ============================================================
// Schema additions — append to schema.sql
// ============================================================

/*
create table onboarding_applications (
  id                    uuid primary key default uuid_generate_v4(),
  application_ref       text unique not null,
  tier                  subscription_tier not null,
  property_name         text not null,
  property_tagline      text,
  borough               london_borough not null,
  postcode              text not null,
  contact_name          text not null,
  contact_email         text not null,
  contact_phone         text,
  past_life             past_life_category,
  era                   text,
  heritage_listing      text,
  retained_features     text[],
  salvage_story         text,
  primary_vibe          vibe_tier,
  experience_tags       text[],
  rack_rate             numeric(10,2),
  protocol_rate         numeric(10,2) not null,
  status                text not null default 'pending_payment',
                        -- pending_payment → payment_confirmed → provisioned → live → rejected
  stripe_customer       text,
  stripe_session        text,
  stripe_sub_id         text,
  payment_confirmed_at  timestamptz,
  property_id           uuid references properties(id),
  reviewer_notes        text,
  reviewed_by           text,
  reviewed_at           timestamptz,
  created_at            timestamptz default now(),
  updated_at            timestamptz default now()
);

create index idx_applications_status  on onboarding_applications(status);
create index idx_applications_email   on onboarding_applications(contact_email);
create index idx_applications_created on onboarding_applications(created_at desc);
*/

// ============================================================
// .env.local additions
// ============================================================

/*
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_CORE=price_...
STRIPE_PRICE_PLUS=price_...
STRIPE_PRICE_ELITE=price_...
NEXT_PUBLIC_BASE_URL=https://londonprotocol.com
*/
