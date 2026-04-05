// app/loop/page.tsx
// ============================================================
// THE LONDON PROTOCOL — The Loop: Browse Page
// Server Component — fetches all active swaps from Supabase
// ============================================================

import type { Metadata }    from 'next'
import { createClient }     from '@supabase/supabase-js'
import { SwapCard }         from '@/components/loop/SwapCard'
import type { NeighbourhoodSwap } from '@/types/loop'

export const revalidate = 3600   // ISR — rebuild every hour

export const metadata: Metadata = {
  title:       'The Loop — Neighbourhood Swap Itineraries | The London Protocol',
  description: 'Two salvaged stays. Two boroughs. One Protocol rate. Book a curated London neighbourhood swap with no OTA commission.',
  keywords:    ['London hotel itinerary', 'neighbourhood swap London', 'boutique hotel package London', 'Salvaged Stay London'],
  openGraph: {
    title:       'The Loop — Neighbourhood Swaps',
    description: 'Two boroughs. One itinerary. Zero commission.',
    type:        'website',
  },
}

async function getSwaps(): Promise<NeighbourhoodSwap[]> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data, error } = await supabase
    .from('neighbourhood_swaps')
    .select(`
      id, slug, name, description, contrast_thesis, shared_thread,
      nights_a, nights_b, loop_rate, loop_saving_pct, aeo_keywords,
      recommended_split,
      property_a:properties!neighbourhood_swaps_property_a_id_fkey (
        id, slug, name, tagline, borough, protocol_nightly,
        past_lives ( former_use, salvaged_stay_score ),
        vibe_metrics ( vibe, score )
      ),
      property_b:properties!neighbourhood_swaps_property_b_id_fkey (
        id, slug, name, tagline, borough, protocol_nightly,
        past_lives ( former_use, salvaged_stay_score ),
        vibe_metrics ( vibe, score )
      )
    `)
    .eq('is_active', true)
    .order('loop_rate', { ascending: true })

  if (error) {
    console.error('[Loop] Fetch failed:', error)
    return []
  }

  return (data ?? []) as unknown as NeighbourhoodSwap[]
}

// ── JSON-LD for the listing page itself ───────────────────────

function buildListingSchema(swaps: NeighbourhoodSwap[]) {
  return {
    '@context': 'https://schema.org',
    '@type':    'CollectionPage',
    name:       'The Loop — London Neighbourhood Swap Itineraries',
    description:'Curated London hotel itineraries pairing two salvaged stays in contrasting boroughs.',
    url:        'https://londonprotocol.com/loop',
    hasPart:    swaps.map(s => ({
      '@type':      'TouristTrip',
      name:          s.name,
      url:          `https://londonprotocol.com/loop/${s.slug}`,
      description:   s.contrast_thesis,
      offers: {
        '@type':        'Offer',
        price:           s.loop_rate,
        priceCurrency:  'GBP',
        availability:   'https://schema.org/InStock',
      },
    })),
  }
}

// ── Page ──────────────────────────────────────────────────────

export default async function LoopPage() {
  const swaps = await getSwaps()

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildListingSchema(swaps)) }}
      />

      <main className="max-w-3xl mx-auto px-4 lg:px-0 pb-20">
        {/* Header */}
        <div className="pt-10 pb-8">
          <p className="font-mono text-[10px] tracking-[0.14em] uppercase text-protocol-teal mb-2">
            Neighbourhood Swap Itineraries
          </p>
          <h1 className="font-display text-4xl font-normal leading-tight mb-3">
            Two boroughs. One <em className="italic text-protocol-gold">itinerary.</em>
          </h1>
          <p className="text-[15px] font-light text-protocol-muted leading-relaxed max-w-xl">
            Each Loop pairs two salvaged stays in contrasting corners of London — different architecture, different energy, separated by miles and decades. Book both at one Protocol rate.
          </p>
        </div>

        {/* Stats bar */}
        <div className="flex gap-6 pb-6 border-b border-protocol-border mb-8">
          {[
            { label: 'Active loops',     val: swaps.length.toString() },
            { label: 'Avg saving',       val: `£${Math.round(swaps.reduce((a,s) => a + (s.loop_rate * (s.loop_saving_pct / 100)), 0) / Math.max(swaps.length, 1))}` },
            { label: 'Zero commission',  val: '100%' },
          ].map(s => (
            <div key={s.label}>
              <p className="font-display text-2xl font-normal text-protocol-ink">{s.val}</p>
              <p className="font-mono text-[9px] tracking-[0.1em] uppercase text-protocol-faint mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Swap cards */}
        {swaps.length === 0 ? (
          <p className="font-display text-xl italic text-protocol-muted text-center py-16">
            No loops available right now.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {swaps.map((swap, i) => (
              <SwapCard key={swap.id} swap={swap} index={i} />
            ))}
          </div>
        )}
      </main>
    </>
  )
}
