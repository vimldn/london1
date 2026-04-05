// types/loop.ts
// ============================================================
// THE LONDON PROTOCOL — Loop TypeScript Types
// ============================================================

export interface NeighbourhoodSwap {
  id:                string
  slug:              string
  name:              string
  description:       string | null
  contrast_thesis:   string | null
  shared_thread:     string | null
  nights_a:          number
  nights_b:          number
  loop_rate:         number
  loop_saving_pct:   number | null
  recommended_split: string | null
  aeo_keywords:      string[] | null
  property_a:        SwapProperty
  property_b:        SwapProperty
}

export interface SwapProperty {
  id:               string
  slug:             string
  name:             string
  tagline:          string | null
  borough:          string
  protocol_nightly: number
  aeo_headline:     string | null
  readaway_keywords:string[] | null
  past_lives:       PastLife[]
  vibe_metrics:     VibeMetric[]
  property_tags:    PropertyTag[]
}

export interface PastLife {
  former_use:          string
  retained_features:   string[]
  salvaged_stay_score: number | null
  era:                 string | null
  heritage_listing:    string | null
}

export interface VibeMetric {
  vibe:                 string
  score:                number
  reading_nook_present: boolean
  circadian_lighting:   boolean
  wifi_speed_mbps:      number | null
}

export interface PropertyTag {
  experience_tags: {
    tag:      string
    category: string
  } | null
}


// ============================================================
// app/actions/book-loop.ts
// Server Action — validate and create a Loop booking
// ============================================================

'use server'

import { createClient } from '@supabase/supabase-js'
import { z }            from 'zod'
import { redirect }     from 'next/navigation'

const BookLoopSchema = z.object({
  swapId:       z.string().uuid(),
  swapSlug:     z.string(),
  checkIn:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  guestName:    z.string().min(2).max(120),
  guestEmail:   z.string().email(),
  guestPhone:   z.string().optional(),
  adults:       z.coerce.number().int().min(1).max(4),
  specialReqs:  z.string().max(500).optional(),
})

export type BookLoopInput  = z.infer<typeof BookLoopSchema>
export type BookLoopResult =
  | { success: true;  bookingRef: string }
  | { success: false; error: string }

export async function bookLoop(
  input: BookLoopInput
): Promise<BookLoopResult> {
  const parsed = BookLoopSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: 'Invalid booking data.' }
  }

  const { swapId, swapSlug, checkIn, guestName, guestEmail, guestPhone, adults, specialReqs } = parsed.data

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Fetch the swap to confirm pricing and get property IDs
  const { data: swap, error: swapErr } = await supabase
    .from('neighbourhood_swaps')
    .select(`
      id, loop_rate, nights_a, nights_b,
      property_a_id, property_b_id
    `)
    .eq('id', swapId)
    .eq('is_active', true)
    .single()

  if (swapErr || !swap) {
    return { success: false, error: 'Loop not found or unavailable.' }
  }

  // Compute check-out dates for each leg
  const checkInDate  = new Date(checkIn)
  const midDate      = new Date(checkIn)
  midDate.setDate(midDate.getDate() + swap.nights_a)
  const checkOutDate = new Date(checkIn)
  checkOutDate.setDate(checkOutDate.getDate() + swap.nights_a + swap.nights_b)

  const fmt = (d: Date) => d.toISOString().split('T')[0]

  // Generate booking reference
  const bookingRef = `LP-${Date.now().toString(36).toUpperCase()}`

  // Insert loop booking
  const { error: bookErr } = await supabase
    .from('loop_bookings')
    .insert({
      booking_ref:       bookingRef,
      swap_id:           swapId,
      property_a_id:     swap.property_a_id,
      property_b_id:     swap.property_b_id,
      check_in_a:        fmt(checkInDate),
      check_out_a:       fmt(midDate),
      check_in_b:        fmt(midDate),
      check_out_b:       fmt(checkOutDate),
      adults,
      total_rate:        swap.loop_rate,
      guest_name:        guestName,
      guest_email:       guestEmail,
      guest_phone:       guestPhone ?? null,
      special_requests:  specialReqs ?? null,
      status:            'pending_payment',
    })

  if (bookErr) {
    console.error('[bookLoop] Insert failed:', bookErr)
    return { success: false, error: 'Booking failed — please try again.' }
  }

  // Hand off to Stripe (redirect to checkout session)
  // In production: create a Stripe Payment Link or Session here,
  // then redirect to the checkout URL.
  // For now, redirect to the confirmation page.
  redirect(`/loop/${swapSlug}/confirm?ref=${bookingRef}`)
}


// ============================================================
// Schema addition — add to schema.sql
// ============================================================

/*
create table loop_bookings (
  id               uuid primary key default uuid_generate_v4(),
  booking_ref      text unique not null,
  swap_id          uuid not null references neighbourhood_swaps(id),
  property_a_id    uuid not null references properties(id),
  property_b_id    uuid not null references properties(id),
  check_in_a       date not null,
  check_out_a      date not null,
  check_in_b       date not null,
  check_out_b      date not null,
  adults           smallint not null default 2,
  total_rate       numeric(10,2) not null,
  guest_name       text not null,
  guest_email      text not null,
  guest_phone      text,
  special_requests text,
  status           text not null default 'pending_payment',
                   -- 'pending_payment','confirmed','cancelled','completed'
  stripe_session   text,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);

create index idx_loop_bookings_swap    on loop_bookings(swap_id);
create index idx_loop_bookings_email   on loop_bookings(guest_email);
create index idx_loop_bookings_status  on loop_bookings(status);
create index idx_loop_bookings_checkin on loop_bookings(check_in_a);
*/
