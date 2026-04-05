'use client'

// components/dashboard/DashboardShell.tsx
// ============================================================
// THE LONDON PROTOCOL — Dashboard Shell
// Client component — handles sidebar nav state only.
// All page content is server-rendered and streamed in.
// ============================================================

import { useState }     from 'react'
import { usePathname }  from 'next/navigation'
import Link             from 'next/link'

interface DashboardShellProps {
  children:     React.ReactNode
  propertyName: string
  borough:      string
  tier:         string
  isLive:       boolean
  propertyId:   string
}

const NAV = [
  {
    section: 'Property',
    items: [
      { href: '/dashboard',           label: 'Overview',   icon: IconGrid    },
      { href: '/dashboard/bookings',  label: 'Bookings',   icon: IconCal     },
      { href: '/dashboard/rates',     label: 'Rates',      icon: IconChart   },
      { href: '/dashboard/analytics', label: 'Analytics',  icon: IconBars    },
    ],
  },
  {
    section: 'Protocol',
    items: [
      { href: '/dashboard/loop',    label: 'The Loop',   icon: IconLoop    },
      { href: '/dashboard/listing', label: 'My listing', icon: IconStar    },
    ],
  },
]

const TIER_LABELS: Record<string, string> = {
  protocol_core:  'Protocol Core',
  protocol_plus:  'Protocol Plus',
  protocol_elite: 'Protocol Elite',
}

export function DashboardShell({
  children, propertyName, borough, tier, isLive,
}: DashboardShellProps) {
  const pathname = usePathname()

  const isActive = (href: string) =>
    href === '/dashboard' ? pathname === href : pathname.startsWith(href)

  return (
    <div className="flex flex-col min-h-screen">
      {/* Top bar */}
      <header className="h-11 bg-protocol-ink flex items-center px-5 gap-3 shrink-0">
        <span className="font-mono text-[11px] tracking-[0.16em] uppercase text-white/90">
          The London Protocol
        </span>
        <span className="w-1 h-1 rounded-full bg-protocol-teal shrink-0" />
        <span className="font-mono text-[10px] tracking-[0.1em] uppercase text-white/35">
          {propertyName}
        </span>
        <div className="ml-auto flex items-center gap-2">
          {isLive && (
            <span className="flex items-center gap-1.5 font-mono text-[9px] tracking-[0.08em] uppercase text-white/30">
              <span className="w-1.5 h-1.5 rounded-full bg-protocol-teal" />
              Live
            </span>
          )}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-48 shrink-0 bg-white border-r border-protocol-border flex flex-col">
          <nav className="flex-1 py-4">
            {NAV.map(group => (
              <div key={group.section} className="mb-5">
                <p className="font-mono text-[8px] tracking-[0.14em] uppercase text-protocol-faint px-4 mb-1">
                  {group.section}
                </p>
                {group.items.map(item => {
                  const active = isActive(item.href)
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={[
                        'flex items-center gap-2 px-4 py-1.5 text-[13px] my-px',
                        'border-l-2 transition-all duration-100',
                        active
                          ? 'border-l-protocol-ink text-protocol-ink bg-protocol-cream'
                          : 'border-l-transparent text-protocol-muted hover:text-protocol-ink hover:bg-protocol-cream',
                      ].join(' ')}
                    >
                      <item.icon
                        className={`w-3.5 h-3.5 shrink-0 transition-opacity ${active ? 'opacity-100' : 'opacity-50'}`}
                      />
                      {item.label}
                    </Link>
                  )
                })}
              </div>
            ))}
          </nav>

          {/* Tier info */}
          <div className="px-4 py-3 border-t border-protocol-border">
            <span className="inline-block font-mono text-[8px] tracking-[0.1em] uppercase bg-protocol-gold-light text-protocol-gold px-2 py-0.5 rounded-sm mb-1.5">
              {TIER_LABELS[tier] ?? tier}
            </span>
            <p className="text-[11px] text-protocol-faint leading-relaxed">
              Manage subscription →
            </p>
          </div>
        </aside>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto bg-protocol-cream px-7 py-7">
          {children}
        </main>
      </div>
    </div>
  )
}


// ============================================================
// components/dashboard/StatCard.tsx
// ============================================================

export function StatCard({
  label, value, sub, accent,
}: {
  label:   string
  value:   string
  sub:     string
  accent?: 'teal'
}) {
  return (
    <div className="bg-white border border-protocol-border rounded-protocol p-3.5">
      <p className="font-mono text-[9px] tracking-[0.1em] uppercase text-protocol-faint mb-1.5">
        {label}
      </p>
      <p className={`font-display text-2xl font-normal leading-none mb-1 ${accent === 'teal' ? 'text-protocol-teal' : 'text-protocol-ink'}`}>
        {value}
      </p>
      <p className="font-mono text-[10px] text-protocol-faint">{sub}</p>
    </div>
  )
}


// ============================================================
// components/dashboard/BookingFeed.tsx
// ============================================================

type BookingStatus = 'confirmed' | 'pending_payment' | 'completed' | 'cancelled'

interface Booking {
  id:          string
  booking_ref: string
  guest_name:  string
  check_in_a:  string
  check_out_b: string
  total_rate:  number
  status:      BookingStatus
}

const STATUS_STYLES: Record<BookingStatus, string> = {
  confirmed:       'bg-protocol-teal-light text-protocol-teal-dark',
  pending_payment: 'bg-protocol-gold-light text-protocol-gold',
  completed:       'bg-protocol-cream-dark text-protocol-muted',
  cancelled:       'bg-red-50 text-red-700',
}

export function BookingFeed({ bookings }: { bookings: Booking[] }) {
  return (
    <div className="bg-white border border-protocol-border rounded-protocol overflow-hidden">
      <div className="px-4 py-2.5 border-b border-protocol-border flex items-center justify-between">
        <span className="font-mono text-[10px] tracking-[0.1em] uppercase text-protocol-faint">
          Recent bookings
        </span>
        <Link
          href="/dashboard/bookings"
          className="font-mono text-[9px] tracking-[0.08em] uppercase text-protocol-teal hover:opacity-70 transition-opacity"
        >
          View all
        </Link>
      </div>

      <div className="px-4 py-1">
        {bookings.length === 0 ? (
          <p className="font-display text-sm italic text-protocol-muted text-center py-6">
            No bookings yet this month.
          </p>
        ) : (
          bookings.slice(0, 6).map(b => (
            <div
              key={b.id}
              className="flex items-center gap-3 py-2 border-b border-protocol-border last:border-0"
            >
              <span className="font-mono text-[10px] text-protocol-muted w-20 shrink-0">
                {b.booking_ref}
              </span>
              <span className="text-[12px] text-protocol-ink flex-1 min-w-0 truncate">
                {b.guest_name}
              </span>
              <span className="font-mono text-[10px] text-protocol-faint w-20 shrink-0 text-right">
                {formatDate(b.check_in_a)}
              </span>
              <span className="font-mono text-[11px] font-medium text-protocol-teal w-12 text-right shrink-0">
                £{Math.round(b.total_rate)}
              </span>
              <span className={`font-mono text-[8px] tracking-[0.06em] uppercase px-1.5 py-0.5 rounded-sm shrink-0 ${STATUS_STYLES[b.status] ?? STATUS_STYLES.completed}`}>
                {b.status.replace('_', ' ')}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}


// ============================================================
// components/dashboard/RateHealthCard.tsx
// ============================================================

export function RateHealthCard({
  protocolRate, otaRate, commissionPct, commRecovered,
}: {
  protocolRate:   number
  otaRate:        number | null
  commissionPct:  number
  commRecovered:  number
}) {
  const comm = otaRate ? Math.round(otaRate * commissionPct / 100) : null
  const save = otaRate ? Math.round(otaRate - protocolRate) : null

  return (
    <div className="bg-white border border-protocol-border rounded-protocol overflow-hidden">
      <div className="px-4 py-2.5 border-b border-protocol-border flex items-center justify-between">
        <span className="font-mono text-[10px] tracking-[0.1em] uppercase text-protocol-faint">
          Rate health
        </span>
        <Link
          href="/dashboard/rates"
          className="font-mono text-[9px] tracking-[0.08em] uppercase text-protocol-teal hover:opacity-70 transition-opacity"
        >
          Edit rates
        </Link>
      </div>

      <div className="px-4 py-2">
        {[
          { label: 'Your Protocol rate',        val: `£${protocolRate}`,                cls: 'text-protocol-teal'   },
          { label: 'Expedia / rack',             val: otaRate ? `£${otaRate}` : '—',    cls: 'line-through text-protocol-faint' },
          { label: 'Commission tax per night',   val: comm ? `-£${comm}` : '—',         cls: 'text-[#c0392b]'       },
          { label: 'Guest saving vs. Expedia',   val: save && otaRate ? `£${save} (${Math.round(save / otaRate * 100)}%)` : '—', cls: 'text-protocol-teal' },
        ].map(r => (
          <div key={r.label} className="flex justify-between items-baseline py-1.5 border-b border-protocol-border last:border-0">
            <span className="text-[12px] text-protocol-muted">{r.label}</span>
            <span className={`font-mono text-[12px] font-medium ${r.cls}`}>{r.val}</span>
          </div>
        ))}
      </div>

      {commRecovered > 0 && (
        <div className="px-4 pb-3 pt-1">
          <div className="flex items-center gap-2.5 bg-protocol-teal-light border border-[rgba(29,158,117,0.2)] rounded-protocol px-3 py-2">
            <span className="font-mono text-[9px] tracking-[0.08em] uppercase text-protocol-teal-dark">
              Commission recovered this month
            </span>
            <span className="font-display text-base italic text-protocol-teal ml-auto">
              £{commRecovered.toLocaleString()}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}


// ============================================================
// components/dashboard/ConciergeChart.tsx
// Server component — fetches 7-day search data
// ============================================================

import { createServerClient as createCC } from '@supabase/ssr'
import { cookies as ccCookies }           from 'next/headers'

export async function ConciergeChart({ propertyId }: { propertyId: string }) {
  const cookieStore = await ccCookies()
  const supabase = createCC(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )

  // Fetch last 7 days of search appearances by day
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    return d.toISOString().split('T')[0]
  })

  const { data: searches } = await supabase
    .from('search_queries')
    .select('created_at, clicked_id')
    .contains('result_ids', [propertyId])
    .gte('created_at', days[0])
    .order('created_at', { ascending: true })

  // Bucket by day
  const buckets: Record<string, { impressions: number; clicks: number }> = {}
  days.forEach(d => { buckets[d] = { impressions: 0, clicks: 0 } })

  ;(searches ?? []).forEach(s => {
    const day = s.created_at.split('T')[0]
    if (buckets[day]) {
      buckets[day].impressions++
      if (s.clicked_id === propertyId) buckets[day].clicks++
    }
  })

  const dayLabels  = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const maxImp     = Math.max(...Object.values(buckets).map(b => b.impressions), 1)

  return (
    <div className="grid grid-cols-2 gap-3">
      {/* Impressions chart */}
      <div className="bg-white border border-protocol-border rounded-protocol overflow-hidden">
        <div className="px-4 py-2.5 border-b border-protocol-border">
          <span className="font-mono text-[10px] tracking-[0.1em] uppercase text-protocol-faint">
            Concierge appearances · 7 days
          </span>
        </div>
        <div className="px-4 pt-3 pb-4">
          <div className="flex items-end gap-1.5 h-16">
            {Object.entries(buckets).map(([day, b], i) => {
              const pct   = Math.max(b.impressions / maxImp, 0.04)
              const isWeekend = i >= 5
              return (
                <div key={day} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className={`w-full rounded-sm transition-all duration-500 ${isWeekend ? 'bg-protocol-teal' : 'bg-protocol-cream-dark'}`}
                    style={{ height: `${Math.round(pct * 56)}px` }}
                  />
                  <span className="font-mono text-[8px] text-protocol-faint">
                    {dayLabels[i]}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Top queries */}
      <div className="bg-white border border-protocol-border rounded-protocol overflow-hidden">
        <div className="px-4 py-2.5 border-b border-protocol-border">
          <span className="font-mono text-[10px] tracking-[0.1em] uppercase text-protocol-faint">
            Top concierge queries
          </span>
        </div>
        <div className="px-4 py-1">
          <TopQueriesServer propertyId={propertyId} supabase={supabase} />
        </div>
      </div>
    </div>
  )
}

async function TopQueriesServer({
  propertyId,
  supabase,
}: {
  propertyId: string
  supabase:   any
}) {
  const { data } = await supabase
    .from('search_queries')
    .select('raw_query, clicked_id')
    .contains('result_ids', [propertyId])
    .order('created_at', { ascending: false })
    .limit(50)

  // Tally query frequency
  const counts: Record<string, { count: number; clicks: number }> = {}
  ;(data ?? []).forEach((s: any) => {
    const q = s.raw_query
    if (!counts[q]) counts[q] = { count: 0, clicks: 0 }
    counts[q].count++
    if (s.clicked_id === propertyId) counts[q].clicks++
  })

  const top = Object.entries(counts)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 5)

  if (top.length === 0) {
    return (
      <p className="font-display text-sm italic text-protocol-muted text-center py-4">
        No queries yet.
      </p>
    )
  }

  const rankCls = ['text-protocol-teal', 'text-protocol-gold', 'text-protocol-muted']

  return (
    <>
      {top.map(([query, stats], i) => (
        <div key={query} className="flex items-center gap-2.5 py-1.5 border-b border-protocol-border last:border-0">
          <span className={`font-mono text-[11px] font-medium w-6 shrink-0 ${rankCls[Math.min(i, 2)]}`}>
            #{i + 1}
          </span>
          <span className="text-[12px] italic text-protocol-muted flex-1 min-w-0 truncate">
            "{query}"
          </span>
          <span className="font-mono text-[9px] text-protocol-faint shrink-0">
            {stats.count}×
          </span>
        </div>
      ))}
    </>
  )
}


// ── Shared Link import ────────────────────────────────────────
// (Link is imported from 'next/link' at the top of each component
// in the actual file — grouped here for clarity)

// ── Icon components ───────────────────────────────────────────

function IconGrid({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 14 14" fill="none">
      <rect x="1" y="1" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2"/>
      <rect x="8" y="1" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2"/>
      <rect x="1" y="8" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2"/>
      <rect x="8" y="8" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2"/>
    </svg>
  )
}
function IconCal({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 14 14" fill="none">
      <rect x="1.5" y="2.5" width="11" height="10" rx="1" stroke="currentColor" strokeWidth="1.2"/>
      <path d="M4.5 1v3M9.5 1v3M1.5 6.5h11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  )
}
function IconChart({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 14 14" fill="none">
      <path d="M2 10l3-3 2.5 2.5L12 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}
function IconBars({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 14 14" fill="none">
      <path d="M2 12V8M5.5 12V5M9 12V7M12.5 12V3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  )
}
function IconLoop({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 14 14" fill="none">
      <path d="M7 2C4.24 2 2 4.24 2 7s2.24 5 5 5 5-2.24 5-5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      <path d="M12 2l-2 2 2 2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}
function IconStar({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 14 14" fill="none">
      <path d="M7 1L8.5 5H13L9.5 7.5 10.5 12 7 9.5 3.5 12 4.5 7.5 1 5H5.5z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
    </svg>
  )
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}
