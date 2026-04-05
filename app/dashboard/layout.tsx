// app/dashboard/layout.tsx
// ============================================================
// THE LONDON PROTOCOL — Dashboard Layout
// Next.js 16 · Server Component · Supabase SSR auth guard
// ============================================================

import { redirect }        from 'next/navigation'
import { createServerClient } from '@supabase/ssr'
import { cookies }         from 'next/headers'
import { DashboardShell }  from '@/components/dashboard/DashboardShell'

// In Next.js 16, all layout children are still RSC by default.
// The shell client component handles sidebar nav — the pages
// themselves remain server components and stream their data.

async function getAuthenticatedHotel() {
  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll:    () => cookieStore.getAll(),
        setAll:    (cs) => cs.forEach(c => cookieStore.set(c)),
      },
    }
  )

  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null

  // Fetch the hotel account linked to this user's email
  const { data: account } = await supabase
    .from('hotel_accounts')
    .select(`
      id, tier, billing_active, stripe_sub_id,
      property:properties (
        id, slug, name, tagline, borough, is_active, is_verified,
        protocol_nightly, ota_rate_cache, commission_tax_pct
      )
    `)
    .eq('contact_email', user.email!)
    .eq('billing_active', true)
    .single()

  return account
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const hotel = await getAuthenticatedHotel()

  if (!hotel) redirect('/login?next=/dashboard')

  const property = hotel.property as any

  return (
    <DashboardShell
      propertyName={property?.name   ?? 'Your Property'}
      borough={property?.borough     ?? ''}
      tier={hotel.tier}
      isLive={property?.is_active    ?? false}
      propertyId={property?.id       ?? ''}
    >
      {children}
    </DashboardShell>
  )
}


// ============================================================
// app/dashboard/page.tsx — Overview (server component)
// ============================================================

import { createServerClient as createSC } from '@supabase/ssr'
import { cookies as getCookies }          from 'next/headers'
import { StatCard }                        from '@/components/dashboard/StatCard'
import { BookingFeed }                     from '@/components/dashboard/BookingFeed'
import { RateHealthCard }                  from '@/components/dashboard/RateHealthCard'
import { ConciergeChart }                  from '@/components/dashboard/ConciergeChart'

// Next.js 16: use 'use cache' instead of export const revalidate
// 'use cache'

async function getDashboardData(propertyId: string) {
  const cookieStore = await getCookies()
  const supabase = createSC(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )

  const now       = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]

  const [bookingsRes, rateRes, searchRes] = await Promise.all([
    // Bookings this month
    supabase
      .from('loop_bookings')
      .select('id, booking_ref, guest_name, check_in_a, check_out_b, total_rate, status, created_at')
      .or(`property_a_id.eq.${propertyId},property_b_id.eq.${propertyId}`)
      .gte('created_at', monthStart)
      .order('created_at', { ascending: false })
      .limit(10),

    // Rate intelligence
    supabase
      .from('latest_rate_intelligence')
      .select('protocol_rate, expedia_rate, commission_saved, scraped_at')
      .eq('property_id', propertyId)
      .single(),

    // Search appearances (last 30 days)
    supabase
      .from('search_queries')
      .select('id, clicked_id, created_at')
      .contains('result_ids', [propertyId])
      .gte('created_at', new Date(Date.now() - 30 * 86400000).toISOString()),
  ])

  const bookings      = bookingsRes.data  ?? []
  const rate          = rateRes.data
  const searches      = searchRes.data    ?? []
  const monthRevenue  = bookings.reduce((s, b) => s + (b.total_rate ?? 0), 0)
  const commRecovered = rate?.commission_saved
    ? Math.round(rate.commission_saved * bookings.length)
    : 0
  const clickedCount  = searches.filter(s => s.clicked_id === propertyId).length
  const ctr           = searches.length ? Math.round(clickedCount / searches.length * 100) : 0

  return { bookings, rate, searches, monthRevenue, commRecovered, ctr, totalSearches: searches.length }
}

// Page is a server component — data fetches on the server,
// streams to the client. The propertyId comes from the layout
// context via a shared server-side cookie/session pattern.
// For simplicity here we re-read from the hotel account.

export default async function DashboardPage() {
  const cookieStore = await getCookies()
  const supabase = createSC(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: account } = await supabase
    .from('hotel_accounts')
    .select('property_id, properties(name, borough, protocol_nightly, ota_rate_cache, commission_tax_pct)')
    .eq('contact_email', user.email!)
    .single()

  if (!account) redirect('/login')

  const propertyId = account.property_id
  const { bookings, rate, commRecovered, ctr, totalSearches } = await getDashboardData(propertyId)

  const property = account.properties as any

  return (
    <div className="space-y-4">
      {/* Greeting */}
      <div className="mb-6">
        <h1 className="font-display text-2xl font-normal">Good morning.</h1>
        <p className="text-sm text-protocol-muted font-light mt-0.5">
          {property?.name} · {formatBorough(property?.borough)} · Protocol Plus ·{' '}
          <span className="text-protocol-teal">Live</span>
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-2.5">
        <StatCard
          label="Commission recovered"
          value={`£${commRecovered.toLocaleString()}`}
          sub="this month"
          accent="teal"
        />
        <StatCard
          label="Protocol bookings"
          value={String(bookings.length)}
          sub="this month"
        />
        <StatCard
          label="Concierge appearances"
          value={String(totalSearches)}
          sub="last 30 days"
        />
        <StatCard
          label="Click-through rate"
          value={`${ctr}%`}
          sub="of search appearances"
          accent="teal"
        />
      </div>

      {/* Main two-col */}
      <div className="grid grid-cols-2 gap-3">
        <BookingFeed bookings={bookings} />
        <RateHealthCard
          protocolRate={rate?.protocol_rate  ?? property?.protocol_nightly}
          otaRate={rate?.expedia_rate        ?? property?.ota_rate_cache}
          commissionPct={property?.commission_tax_pct ?? 25}
          commRecovered={commRecovered}
        />
      </div>

      {/* Bottom row */}
      <ConciergeChart propertyId={propertyId} />
    </div>
  )
}

function formatBorough(b: string) {
  return (b ?? '').split('_').map(w => w[0]?.toUpperCase() + w.slice(1)).join(' ')
}
