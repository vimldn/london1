// app/loop/[slug]/page.tsx
// ============================================================
// THE LONDON PROTOCOL — Individual Loop Page
// Server Component | generateStaticParams | Full JSON-LD
// ============================================================

import type { Metadata }      from 'next'
import { notFound }           from 'next/navigation'
import { createClient }       from '@supabase/supabase-js'
import { SwapItinerary }      from '@/components/loop/SwapItinerary'
import { generateSwapSchema } from '@/lib/schema/property-jsonld'
import type { NeighbourhoodSwap } from '@/types/loop'

export const revalidate = 3600

// ── Static params ─────────────────────────────────────────────

export async function generateStaticParams() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const { data } = await supabase
    .from('neighbourhood_swaps')
    .select('slug')
    .eq('is_active', true)

  return (data ?? []).map(s => ({ slug: s.slug }))
}

// ── Data fetch ────────────────────────────────────────────────

async function getSwap(slug: string): Promise<NeighbourhoodSwap | null> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data, error } = await supabase
    .from('neighbourhood_swaps')
    .select(`
      id, slug, name, description, contrast_thesis, shared_thread,
      nights_a, nights_b, loop_rate, loop_saving_pct,
      recommended_split, aeo_keywords,
      property_a:properties!neighbourhood_swaps_property_a_id_fkey (
        id, slug, name, tagline, borough, protocol_nightly,
        aeo_headline, readaway_keywords,
        past_lives ( former_use, retained_features, salvaged_stay_score, era, heritage_listing ),
        vibe_metrics ( vibe, score, reading_nook_present, circadian_lighting, wifi_speed_mbps ),
        property_tags ( experience_tags ( tag, category ) )
      ),
      property_b:properties!neighbourhood_swaps_property_b_id_fkey (
        id, slug, name, tagline, borough, protocol_nightly,
        aeo_headline, readaway_keywords,
        past_lives ( former_use, retained_features, salvaged_stay_score, era, heritage_listing ),
        vibe_metrics ( vibe, score, reading_nook_present, circadian_lighting, wifi_speed_mbps ),
        property_tags ( experience_tags ( tag, category ) )
      )
    `)
    .eq('slug', slug)
    .eq('is_active', true)
    .single()

  if (error || !data) return null
  return data as unknown as NeighbourhoodSwap
}

// ── Metadata ──────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: { slug: string }
}): Promise<Metadata> {
  const swap = await getSwap(params.slug)
  if (!swap) return {}

  const boroughA = formatBorough(swap.property_a.borough)
  const boroughB = formatBorough(swap.property_b.borough)

  return {
    title:       `${swap.name} | The Loop | The London Protocol`,
    description: `${swap.contrast_thesis} — ${swap.nights_a + swap.nights_b} nights across ${boroughA} and ${boroughB}. Book direct from £${swap.loop_rate}. Zero commission.`,
    keywords:    [
      ...(swap.aeo_keywords ?? []),
      'London neighbourhood swap',
      'Salvaged Stay London',
      `${boroughA} hotel`,
      `${boroughB} hotel`,
      'boutique hotel London itinerary',
    ],
    openGraph: {
      title:       swap.name,
      description: swap.contrast_thesis ?? swap.description,
      type:        'website',
      url:         `https://londonprotocol.com/loop/${swap.slug}`,
    },
    alternates: {
      canonical: `https://londonprotocol.com/loop/${swap.slug}`,
    },
  }
}

// ── Page ──────────────────────────────────────────────────────

export default async function LoopSlugPage({
  params,
}: {
  params: { slug: string }
}) {
  const swap = await getSwap(params.slug)
  if (!swap) notFound()

  const schema = generateSwapSchema({
    name:           swap.name,
    slug:           swap.slug,
    description:    swap.description ?? swap.contrast_thesis ?? '',
    contrastThesis: swap.contrast_thesis ?? '',
    propertyA: {
      name:    swap.property_a.name,
      borough: swap.property_a.borough,
      slug:    swap.property_a.slug,
      nights:  swap.nights_a,
    },
    propertyB: {
      name:    swap.property_b.name,
      borough: swap.property_b.borough,
      slug:    swap.property_b.slug,
      nights:  swap.nights_b,
    },
    loopRate: swap.loop_rate,
  })

  const totalNights   = swap.nights_a + swap.nights_b
  const separateTotal = swap.property_a.protocol_nightly * swap.nights_a +
                        swap.property_b.protocol_nightly * swap.nights_b
  const saving        = Math.round(separateTotal - swap.loop_rate)

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />

      <main className="max-w-3xl mx-auto px-4 lg:px-0 pb-20">
        {/* Breadcrumb */}
        <nav className="pt-6 mb-8">
          <a
            href="/loop"
            className="font-mono text-[10px] tracking-[0.1em] uppercase text-protocol-faint hover:text-protocol-muted transition-colors"
          >
            ← The Loop
          </a>
        </nav>

        {/* Hero */}
        <div className="mb-10">
          <p className="font-mono text-[10px] tracking-[0.14em] uppercase text-protocol-teal mb-2">
            Neighbourhood Swap · {totalNights} nights
          </p>
          <h1 className="font-display text-3xl lg:text-4xl font-normal leading-tight mb-4">
            {swap.name}
          </h1>
          {swap.contrast_thesis && (
            <blockquote className="border-l-2 border-protocol-gold pl-4 py-1 my-5">
              <p className="font-display text-lg italic text-protocol-muted leading-relaxed">
                {swap.contrast_thesis}
              </p>
            </blockquote>
          )}
          <div className="flex flex-wrap gap-2 mt-4">
            <LoopBadge>{totalNights} nights total</LoopBadge>
            {saving > 0 && <LoopBadge variant="teal">Save £{saving} vs. booking separately</LoopBadge>}
            <LoopBadge variant="purple">
              {formatBorough(swap.property_a.borough)} + {formatBorough(swap.property_b.borough)}
            </LoopBadge>
          </div>
        </div>

        {/* Full itinerary */}
        <SwapItinerary swap={swap} saving={saving} totalNights={totalNights} />

        {/* Shared thread */}
        {swap.shared_thread && (
          <div className="bg-white border border-protocol-border rounded-sm p-5 mb-4">
            <p className="font-mono text-[9px] tracking-[0.1em] uppercase text-protocol-faint mb-3">
              Shared thread
            </p>
            <p className="font-display text-base italic text-protocol-muted leading-relaxed">
              {swap.shared_thread}
            </p>
          </div>
        )}

        {/* Sticky booking strip */}
        <div className="bg-protocol-ink rounded-sm px-5 py-4 flex items-center justify-between gap-4 sticky bottom-4">
          <div>
            <div className="flex items-baseline gap-3 mb-1">
              <span className="font-display text-2xl text-white font-normal">
                £{swap.loop_rate.toLocaleString()}
              </span>
              {saving > 0 && (
                <span className="font-mono text-[9px] tracking-[0.06em] uppercase bg-protocol-teal text-white px-2 py-0.5 rounded-sm">
                  Save £{saving}
                </span>
              )}
            </div>
            <p className="font-mono text-[9px] tracking-[0.08em] uppercase text-white/40">
              {totalNights} nights · {swap.property_a.name} + {swap.property_b.name} · Protocol direct
            </p>
          </div>
          <a
            href={`/loop/${swap.slug}/book`}
            className="font-mono text-[10px] tracking-[0.12em] uppercase px-5 py-2.5 border border-white/30 text-white rounded-sm hover:bg-white/10 transition-colors whitespace-nowrap"
          >
            Book this loop
          </a>
        </div>
      </main>
    </>
  )
}

// ── Badge ─────────────────────────────────────────────────────

function LoopBadge({
  children,
  variant = 'default',
}: {
  children: React.ReactNode
  variant?: 'default' | 'teal' | 'purple'
}) {
  const cls = {
    default: 'bg-protocol-cream-dark text-protocol-muted',
    teal:    'bg-protocol-teal-light text-protocol-teal-dark',
    purple:  'bg-[#e8e0f0] text-[#4a2d82]',
  }[variant]

  return (
    <span className={`font-mono text-[9px] tracking-[0.08em] uppercase px-2 py-1 rounded-sm ${cls}`}>
      {children}
    </span>
  )
}

function formatBorough(b: string) {
  return b.split('_').map(w => w[0].toUpperCase() + w.slice(1)).join(' ')
}
