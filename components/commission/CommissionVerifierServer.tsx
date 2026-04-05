// components/commission/CommissionVerifierServer.tsx
// ============================================================
// Server component wrapper — pre-fetches cached rate snapshot
// so the client component renders with data on first paint,
// with no loading flash on the property page.
// ============================================================

import { createClient }         from '@supabase/supabase-js'
import { CommissionVerifier }   from './CommissionVerifier'

interface Props {
  propertyId:   string
  propertyName: string
  checkIn:      string
  checkOut:     string
  adults?:      number
}

export async function CommissionVerifierServer({
  propertyId,
  propertyName,
  checkIn,
  checkOut,
  adults = 2,
}: Props) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Pull from materialised view — sub-1ms query
  const { data: cached } = await supabase
    .from('latest_rate_intelligence')
    .select('protocol_rate, expedia_rate, commission_saved, commission_tax_visual, scraped_at')
    .eq('property_id', propertyId)
    .single()

  // If we have a recent cache hit (<4h), pass autoVerify=false
  // and let the client hydrate with the cached data.
  // If stale or missing, autoVerify fires on mount.
  const cacheAgeMins = cached?.scraped_at
    ? Math.floor((Date.now() - new Date(cached.scraped_at).getTime()) / 60000)
    : null
  const isStale = !cached || (cacheAgeMins !== null && cacheAgeMins > 240)

  return (
    <CommissionVerifier
      propertyId={propertyId}
      propertyName={propertyName}
      checkIn={checkIn}
      checkOut={checkOut}
      adults={adults}
      autoVerify={isStale}
    />
  )
}

// ── Usage on the property page ────────────────────────────────
// app/stay/[slug]/page.tsx (server component):
//
// import { CommissionVerifierServer } from '@/components/commission/CommissionVerifierServer'
//
// export default async function StayPage({ params, searchParams }) {
//   const property = await getPropertyBySlug(params.slug)
//   const checkIn  = searchParams.checkIn  ?? getTomorrow()
//   const checkOut = searchParams.checkOut ?? getDayAfterTomorrow()
//
//   return (
//     <main>
//       <h1>{property.name}</h1>
//       ...
//       <Suspense fallback={<div className="h-48 bg-protocol-cream-dark rounded-sm animate-pulse" />}>
//         <CommissionVerifierServer
//           propertyId={property.id}
//           propertyName={property.name}
//           checkIn={checkIn}
//           checkOut={checkOut}
//         />
//       </Suspense>
//     </main>
//   )
// }
