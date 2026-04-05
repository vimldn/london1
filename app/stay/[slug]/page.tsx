// app/stay/[slug]/page.tsx
// ============================================================
// THE LONDON PROTOCOL — Property Page
// Next.js 16 · async params · generateStaticParams · RSC
// ============================================================

import type { Metadata }          from 'next'
import { notFound }               from 'next/navigation'
import { createServerClient }     from '@supabase/ssr'
import { cookies }                from 'next/headers'
import { Suspense }               from 'react'
import { BookingWidget }          from '@/components/property/BookingWidget'
import { CommissionVerifierServer } from '@/components/commission/CommissionVerifierServer'
import { generatePropertySchema } from '@/lib/schema/property-jsonld'
import type { PropertyResult }    from '@/app/actions/semantic-search'

// ── Next.js 16: params is now a Promise ──────────────────────

type Params      = Promise<{ slug: string }>
type SearchParams = Promise<{ checkIn?: string; checkOut?: string; guests?: string }>

// ── Static params ─────────────────────────────────────────────

export async function generateStaticParams() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
  const { data } = await supabase
    .from('properties')
    .select('slug')
    .eq('is_active', true)
  return (data ?? []).map(p => ({ slug: p.slug }))
}

// ── Data fetch ────────────────────────────────────────────────

async function getProperty(slug: string) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )

  const { data, error } = await supabase
    .from('properties')
    .select(`
      id, slug, name, tagline, description, borough, postcode,
      protocol_nightly, rack_rate, ota_rate_cache, commission_tax_pct,
      aeo_headline, readaway_keywords, schema_type, is_verified,
      past_lives (
        former_use, era, original_name, year_built, year_converted,
        retained_features, salvage_story, heritage_listing, salvaged_stay_score
      ),
      vibe_metrics (
        vibe, score, reading_nook_present, circadian_lighting,
        wifi_speed_mbps, desk_quality_score, no_ambient_music
      ),
      property_tags (
        confidence,
        experience_tags ( tag, category, aeo_weight )
      )
    `)
    .eq('slug', slug)
    .eq('is_active', true)
    .single()

  if (error || !data) return null
  return data
}

async function getRelatedLoop(propertyId: string) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
  const { data } = await supabase
    .from('neighbourhood_swaps')
    .select(`
      slug, name, contrast_thesis, loop_rate, nights_a, nights_b,
      property_a:properties!neighbourhood_swaps_property_a_id_fkey(name, borough),
      property_b:properties!neighbourhood_swaps_property_b_id_fkey(name, borough)
    `)
    .or(`property_a_id.eq.${propertyId},property_b_id.eq.${propertyId}`)
    .eq('is_active', true)
    .limit(1)
    .single()
  return data
}

// ── Metadata ──────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Params
}): Promise<Metadata> {
  const { slug } = await params
  const property = await getProperty(slug)
  if (!property) return {}

  const borough = fmtBorough(property.borough)
  const pastLife = property.past_lives?.[0]?.former_use
  const pastLifeLabel = pastLife ? fmtPastLife(pastLife) : null

  return {
    title:       `${property.name} | The London Protocol`,
    description: property.aeo_headline
      ?? `${property.tagline} — Book direct from £${property.protocol_nightly} per night. Zero OTA commission. ${borough}${pastLifeLabel ? `, former ${pastLifeLabel.toLowerCase()}` : ''}.`,
    keywords: [
      property.name,
      `${borough} boutique hotel`,
      ...(pastLifeLabel ? [`converted ${pastLifeLabel.toLowerCase()} hotel London`, `former ${pastLifeLabel.toLowerCase()} London hotel`] : []),
      ...(property.readaway_keywords ?? []),
      'Salvaged Stay London',
      'Protocol direct rate',
      'no commission hotel London',
    ],
    openGraph: {
      title:       property.name,
      description: property.tagline ?? property.aeo_headline ?? '',
      type:        'website',
      url:         `https://londonprotocol.com/stay/${slug}`,
    },
    alternates: {
      canonical: `https://londonprotocol.com/stay/${slug}`,
    },
  }
}

// ── Page ──────────────────────────────────────────────────────

export default async function StayPage({
  params,
  searchParams,
}: {
  params:       Params
  searchParams: SearchParams
}) {
  const { slug }                          = await params
  const { checkIn, checkOut, guests = '2' } = await searchParams

  const [property, loop] = await Promise.all([
    getProperty(slug),
    getProperty(slug).then(p => p ? getRelatedLoop(p.id) : null),
  ])

  if (!property) notFound()

  const checkInDate  = checkIn  ?? getTomorrow()
  const checkOutDate = checkOut ?? getNextDay(checkInDate, 2)

  // Build JSON-LD for this property
  const propertyResult: Partial<PropertyResult> = {
    id:                property.id,
    slug:              property.slug,
    name:              property.name,
    tagline:           property.tagline,
    borough:           property.borough,
    protocolNightly:   property.protocol_nightly,
    otaRateCache:      property.ota_rate_cache,
    commissionTaxPct:  property.commission_tax_pct,
    pastLife:          property.past_lives?.[0]?.former_use ?? null,
    retainedFeatures:  property.past_lives?.[0]?.retained_features ?? [],
    salvagedStayScore: property.past_lives?.[0]?.salvaged_stay_score ?? null,
    matchedTags:       property.property_tags?.map((t: any) => t.experience_tags?.tag).filter(Boolean) ?? [],
    aeoHeadline:       property.aeo_headline,
    schemaType:        property.schema_type,
  }

  const schema = generatePropertySchema({
    property:  propertyResult as PropertyResult,
    checkIn:   checkInDate,
    checkOut:  checkOutDate,
  })

  const allTags    = property.property_tags?.map((t: any) => t.experience_tags?.tag).filter(Boolean) ?? []
  const pastLife   = property.past_lives?.[0]
  const vibe       = property.vibe_metrics?.[0]
  const commAmt    = property.ota_rate_cache
    ? Math.round(property.ota_rate_cache * (property.commission_tax_pct / 100))
    : null

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />

      <main className="bg-protocol-cream">
        <div className="max-w-[900px] mx-auto px-6 pb-20">

          {/* Breadcrumb */}
          <nav className="py-4">
            <a href="/loop" className="font-mono text-[10px] tracking-[0.08em] uppercase text-protocol-faint hover:text-protocol-muted transition-colors">
              ← Browse stays
            </a>
          </nav>

          {/* Hero grid */}
          <div className="grid grid-cols-[1fr_300px] gap-8 items-start mb-8">

            {/* Left column */}
            <div>
              {/* Badges */}
              <div className="flex flex-wrap gap-1.5 mb-3">
                <PropertyBadge variant="borough">{fmtBorough(property.borough)}</PropertyBadge>
                {pastLife && <PropertyBadge variant="salvage">{fmtPastLife(pastLife.former_use)}</PropertyBadge>}
                {vibe && <PropertyBadge variant="vibe">{fmtVibe(vibe.vibe)}</PropertyBadge>}
                {pastLife?.heritage_listing && <PropertyBadge variant="heritage">{pastLife.heritage_listing}</PropertyBadge>}
                {property.is_verified && <PropertyBadge variant="verified">Protocol Verified</PropertyBadge>}
              </div>

              {/* Name + tagline */}
              <h1 className="font-display text-[2.1rem] font-normal leading-tight mb-2">
                {property.name}
              </h1>
              {property.tagline && (
                <p className="font-display text-lg italic text-protocol-muted mb-4 leading-relaxed">
                  {property.tagline}
                </p>
              )}

              {/* AEO headline */}
              {property.aeo_headline && (
                <p className="font-mono text-[10px] tracking-[0.08em] text-protocol-faint leading-relaxed mb-5 max-w-[480px]">
                  {property.aeo_headline}
                </p>
              )}

              {/* Image grid placeholder */}
              <div className="grid grid-cols-2 gap-1 mb-6 rounded-protocol overflow-hidden" style={{ gridTemplateRows: 'auto auto' }}>
                <div className="bg-protocol-cream-dark flex items-center justify-center" style={{ gridRow: '1/3', height: '220px' }}>
                  <span className="font-mono text-[8px] tracking-[0.1em] uppercase text-protocol-faint">Common room</span>
                </div>
                <div className="bg-protocol-cream-dark flex items-center justify-center h-[107px]">
                  <span className="font-mono text-[8px] tracking-[0.1em] uppercase text-protocol-faint">Room 4</span>
                </div>
                <div className="bg-protocol-cream-dark flex items-center justify-center h-[107px]">
                  <span className="font-mono text-[8px] tracking-[0.1em] uppercase text-protocol-faint">Courtyard</span>
                </div>
              </div>

              {/* Feature tags */}
              <div className="flex flex-wrap gap-1.5 mb-6">
                {allTags.map((tag: string) => (
                  <span key={tag} className="font-mono text-[9px] tracking-[0.06em] uppercase px-2 py-1 bg-protocol-teal-light text-protocol-teal-dark rounded-protocol">
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            {/* Booking widget */}
            <div className="sticky top-5">
              <BookingWidget
                propertyId={property.id}
                propertySlug={property.slug}
                protocolRate={property.protocol_nightly}
                otaRate={property.ota_rate_cache ?? property.rack_rate}
                commissionPct={property.commission_tax_pct}
                defaultCheckIn={checkInDate}
                defaultCheckOut={checkOutDate}
                defaultGuests={parseInt(guests)}
              />
            </div>
          </div>

          {/* Commission strip */}
          {commAmt && (
            <div className="flex items-center justify-between bg-[#fdf0ef] border border-[rgba(192,57,43,0.12)] rounded-protocol px-4 py-2.5 mb-7">
              <span className="font-mono text-[10px] letter-spacing-wide text-[#c0392b]">
                £{commAmt} Expedia commission tax avoided per night
              </span>
              <span className="font-mono text-[10px] font-medium text-protocol-teal">
                Book direct · save every time
              </span>
            </div>
          )}

          {/* Rate verification */}
          <Section label="Rate verification">
            <Suspense fallback={<div className="h-48 bg-protocol-cream-dark rounded-protocol animate-pulse" />}>
              <CommissionVerifierServer
                propertyId={property.id}
                propertyName={property.name}
                checkIn={checkInDate}
                checkOut={checkOutDate}
              />
            </Suspense>
          </Section>

          {/* Salvaged Stay */}
          {pastLife && (
            <Section label="Salvaged Stay profile">
              <div className="bg-white border border-protocol-border border-l-[3px] border-l-[#9b59b6] rounded-protocol p-4">
                <p className="font-mono text-[9px] tracking-[0.1em] uppercase text-[#6c3483] mb-3">
                  Past life · {fmtPastLife(pastLife.former_use)}
                  {pastLife.era ? ` · ${pastLife.era}` : ''}
                  {pastLife.heritage_listing ? ` · ${pastLife.heritage_listing}` : ''}
                </p>
                {pastLife.original_name && (
                  <p className="font-display text-lg font-normal mb-2">
                    {pastLife.original_name}
                  </p>
                )}
                {pastLife.salvage_story && (
                  <p className="text-[13px] text-protocol-muted leading-relaxed mb-3 font-light">
                    {pastLife.salvage_story}
                  </p>
                )}
                {pastLife.retained_features?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {pastLife.retained_features.map((f: string) => (
                      <span key={f} className="text-[11px] text-[#6c3483] bg-[#f0e8f8] px-2 py-0.5 rounded-protocol">
                        {f}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </Section>
          )}

          {/* The Loop */}
          {loop && (
            <Section label="The Loop · neighbourhood swap">
              <a
                href={`/loop/${loop.slug}`}
                className="flex gap-4 items-start bg-white border border-protocol-border rounded-protocol p-4 hover:border-protocol-border-strong transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-protocol-ink flex items-center justify-center shrink-0 mt-0.5">
                  <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 14 14" fill="none">
                    <path d="M7 2C4.24 2 2 4.24 2 7s2.24 5 5 5 5-2.24 5-5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                    <path d="M12 2l-2 2 2 2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <div>
                  <p className="font-display text-base font-normal mb-1">{loop.name}</p>
                  {loop.contrast_thesis && (
                    <p className="text-[13px] italic text-protocol-muted leading-relaxed mb-2">
                      {loop.contrast_thesis}
                    </p>
                  )}
                  <p className="font-mono text-[10px] tracking-wide text-protocol-teal">
                    £{loop.loop_rate} for {(loop.nights_a ?? 2) + (loop.nights_b ?? 2)} nights ·
                    includes {(loop.property_a as any)?.name} + {(loop.property_b as any)?.name} →
                  </p>
                </div>
              </a>
            </Section>
          )}

        </div>
      </main>
    </>
  )
}

// ── Sub-components ────────────────────────────────────────────

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-7">
      <p className="font-mono text-[9px] tracking-[0.14em] uppercase text-protocol-faint mb-3 pb-2 border-b border-protocol-border">
        {label}
      </p>
      {children}
    </div>
  )
}

type BadgeVariant = 'borough' | 'salvage' | 'vibe' | 'heritage' | 'verified'
const BADGE_CLS: Record<BadgeVariant, string> = {
  borough:  'bg-protocol-cream-dark text-protocol-muted',
  salvage:  'bg-[#e8e0f0] text-[#4a2d82]',
  vibe:     'bg-protocol-gold-light text-protocol-gold',
  heritage: 'bg-protocol-cream-dark text-protocol-gold',
  verified: 'bg-protocol-teal-light text-protocol-teal-dark',
}
function PropertyBadge({ variant, children }: { variant: BadgeVariant; children: React.ReactNode }) {
  return (
    <span className={`font-mono text-[9px] tracking-[0.08em] uppercase px-2 py-0.5 rounded-protocol ${BADGE_CLS[variant]}`}>
      {children}
    </span>
  )
}

// ── Helpers ───────────────────────────────────────────────────

function fmtBorough(b: string) {
  return (b ?? '').split('_').map(w => w[0]?.toUpperCase() + w.slice(1)).join(' ')
}
function fmtPastLife(pl: string) {
  return (pl ?? '').split('_').map(w => w[0]?.toUpperCase() + w.slice(1)).join(' ')
}
function fmtVibe(v: string) {
  return (v ?? '').split('_').map(w => w[0]?.toUpperCase() + w.slice(1)).join(' ')
}
function getTomorrow() {
  const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().split('T')[0]
}
function getNextDay(from: string, n = 1) {
  const d = new Date(from); d.setDate(d.getDate() + n); return d.toISOString().split('T')[0]
}
