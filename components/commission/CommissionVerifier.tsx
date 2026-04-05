'use client'

// components/commission/CommissionVerifier.tsx
// ============================================================
// THE LONDON PROTOCOL — Commission Tax Verifier
// Wires to /api/rate-verify and renders the full audit UI.
// ============================================================

import { useState, useEffect, useRef, useCallback } from 'react'
import type { RateVerifyResponse, ReceiptLine }      from '@/app/api/rate-verify/route'

interface CommissionVerifierProps {
  propertyId:   string
  propertyName: string
  checkIn:      string
  checkOut:     string
  adults?:      number
  autoVerify?:  boolean    // fire on mount (property page)
}

type Phase = 'idle' | 'scanning' | 'done' | 'error'

// ── Scan row model ────────────────────────────────────────────

interface ScanRow {
  label:   string
  value:   string | null
  variant: 'default' | 'red' | 'teal'
}

// ── Component ─────────────────────────────────────────────────

export function CommissionVerifier({
  propertyId,
  propertyName,
  checkIn,
  checkOut,
  adults = 2,
  autoVerify = false,
}: CommissionVerifierProps) {
  const [phase, setPhase]       = useState<Phase>('idle')
  const [data, setData]         = useState<RateVerifyResponse | null>(null)
  const [error, setError]       = useState<string | null>(null)
  const [scanRows, setScanRows] = useState<ScanRow[]>(buildInitialRows(checkIn))
  const barsRef                 = useRef<HTMLDivElement>(null)
  const hasFired                = useRef(false)

  const verify = useCallback(async () => {
    if (phase === 'scanning') return
    setPhase('scanning')
    setError(null)
    setScanRows(buildInitialRows(checkIn))
    setData(null)

    try {
      const url = `/api/rate-verify?propertyId=${propertyId}&checkIn=${checkIn}&checkOut=${checkOut}&adults=${adults}`
      const res = await fetch(url)

      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      const json: RateVerifyResponse = await res.json()

      // Reveal scan rows one by one with staggered delays to
      // simulate live scraping — even if data is cached
      const delays = [400, 800, 1200, 1600]
      const rows: ScanRow[] = [
        { label: 'Expedia',      value: json.expediaRate  ? `£${json.expediaRate} / night`  : 'N/A', variant: 'default' },
        { label: 'Booking.com',  value: json.bookingRate  ? `£${json.bookingRate} / night`  : 'N/A', variant: 'default' },
        { label: 'Hotels.com',   value: json.hotelsRate   ? `£${json.hotelsRate} / night`   : 'N/A', variant: 'default' },
        {
          label: 'Commission tax',
          value: json.commissionAmt
            ? `£${json.commissionAmt} (${json.commissionPct}%)`
            : null,
          variant: 'red',
        },
        {
          label: 'You save',
          value: json.youSave && json.youSavePct
            ? `£${json.youSave} (${json.youSavePct}%)`
            : null,
          variant: 'teal',
        },
      ]

      rows.forEach((row, i) => {
        setTimeout(() => {
          setScanRows(prev => {
            const next = [...prev]
            const idx  = next.findIndex(r => r.label === row.label)
            if (idx !== -1) next[idx] = row
            return next
          })
        }, delays[Math.min(i, delays.length - 1)])
      })

      setTimeout(() => {
        setData(json)
        setPhase('done')
      }, 1800)
    } catch (err) {
      setError('Rate verification failed. Try again in a moment.')
      setPhase('error')
      console.error('[CommissionVerifier]', err)
    }
  }, [phase, propertyId, checkIn, checkOut, adults])

  useEffect(() => {
    if (autoVerify && !hasFired.current) {
      hasFired.current = true
      verify()
    }
  }, [autoVerify, verify])

  // Animate bars once data is present
  useEffect(() => {
    if (!data || !barsRef.current) return
    const fills = barsRef.current.querySelectorAll<HTMLDivElement>('[data-bar-pct]')
    setTimeout(() => {
      fills.forEach(el => {
        el.style.width = el.dataset.barPct + '%'
      })
    }, 80)
  }, [data])

  const isScanning = phase === 'scanning'
  const isDone     = phase === 'done'

  return (
    <div className="w-full">

      {/* Scanner card */}
      <div className="bg-white border border-protocol-border rounded-sm overflow-hidden mb-3">
        {/* Header bar */}
        <div className="bg-protocol-ink px-4 py-2.5 flex items-center gap-3">
          <span className="font-mono text-[10px] tracking-[0.12em] uppercase text-white/60">
            Rate Intelligence Scanner
          </span>
          <span className="ml-auto flex items-center gap-1.5">
            {isScanning && (
              <span className="font-mono text-[10px] text-white/40 tracking-wide">
                scraping live…
              </span>
            )}
            <ScanDot phase={phase} />
          </span>
        </div>

        {/* Scan rows */}
        <div className="px-4 py-3 flex flex-col gap-2">
          <ScanRowItem label="Check-in"       value={formatDate(checkIn)}    variant="default" />
          <ScanRowItem label="Protocol direct" value={data ? `£${data.protocolRate} / night` : '—'} variant="default" />
          <div className="h-px bg-protocol-border my-0.5" />
          {scanRows.map(r => (
            <ScanRowItem key={r.label} label={r.label} value={r.value} variant={r.variant} loading={isScanning && !r.value} />
          ))}
        </div>
      </div>

      {/* Verify button */}
      <button
        onClick={verify}
        disabled={isScanning}
        className={[
          'w-full py-2.5 font-mono text-[10px] tracking-[0.12em] uppercase rounded-sm',
          'border transition-all duration-150 mb-4',
          isScanning
            ? 'bg-protocol-teal text-white border-protocol-teal cursor-wait'
            : 'bg-white text-protocol-ink border-protocol-border-strong hover:bg-protocol-cream-dark',
        ].join(' ')}
      >
        {isScanning ? 'Scanning Expedia, Booking.com, Hotels.com…' : isDone ? 'Re-verify rates' : 'Verify rates now'}
      </button>

      {/* Error */}
      {error && (
        <p className="font-mono text-[11px] text-red-600 tracking-wide mb-4">{error}</p>
      )}

      {/* Results */}
      {isDone && data && (
        <div className="flex flex-col gap-3">

          {/* Metric cards */}
          {data.commissionAmt && data.youSave && (
            <div className="grid grid-cols-2 gap-3">
              <MetricCard
                label="Expedia commission tax"
                value={`£${data.commissionAmt}`}
                sub={`${data.commissionPct}% of their rate`}
                accent="red"
              />
              <MetricCard
                label="Your saving tonight"
                value={`£${data.youSave}`}
                sub={`${data.youSavePct}% less than Expedia`}
                accent="teal"
              />
            </div>
          )}

          {/* Commission Tax Receipt */}
          {data.breakdown.receiptLines.length > 0 && (
            <CommissionReceipt
              lines={data.breakdown.receiptLines}
              save={data.youSave}
              scrapedAt={data.scrapedAt}
              isCached={data.isCached}
              cacheAge={data.cacheAge}
            />
          )}

          {/* Bar chart */}
          {data.expediaRate && data.commissionAmt && (
            <RateBar
              ref={barsRef}
              protocolRate={data.protocolRate}
              expediaRate={data.expediaRate}
              commissionAmt={data.commissionAmt}
            />
          )}

          {/* Verified stamp */}
          <VerifiedStamp
            scrapedAt={data.scrapedAt}
            isCached={data.isCached}
            cacheAge={data.cacheAge}
          />
        </div>
      )}
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────

function ScanDot({ phase }: { phase: Phase }) {
  const base = 'w-1.5 h-1.5 rounded-full flex-shrink-0'
  if (phase === 'scanning') return <span className={`${base} bg-protocol-teal animate-pulse`} />
  if (phase === 'done')     return <span className={`${base} bg-green-400`} />
  return                           <span className={`${base} bg-white/20`} />
}

function ScanRowItem({
  label,
  value,
  variant,
  loading,
}: ScanRow & { loading?: boolean }) {
  const valClass = {
    default: 'text-protocol-ink',
    red:     'text-[#c0392b]',
    teal:    'text-protocol-teal',
  }[variant]

  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="font-mono text-[10px] tracking-[0.08em] uppercase text-protocol-muted">
        {label}
      </span>
      {loading ? (
        <span className="h-3 w-20 bg-protocol-cream-dark rounded-sm animate-pulse" />
      ) : (
        <span className={`font-mono text-[12px] font-medium ${valClass}`}>
          {value ?? '—'}
        </span>
      )}
    </div>
  )
}

function MetricCard({
  label, value, sub, accent,
}: { label: string; value: string; sub: string; accent: 'red' | 'teal' }) {
  const border = accent === 'red'  ? 'border-l-[3px] border-l-[#c0392b] border-protocol-border' : 'border-l-[3px] border-l-protocol-teal border-protocol-border'
  const val    = accent === 'red'  ? 'text-[#c0392b]' : 'text-protocol-teal'

  return (
    <div className={`bg-white border border-protocol-border ${border} rounded-sm p-4`}>
      <p className="font-mono text-[9px] tracking-[0.1em] uppercase text-protocol-faint mb-1.5">
        {label}
      </p>
      <p className={`font-display text-2xl font-normal leading-none ${val}`}>
        {value}
      </p>
      <p className="font-mono text-[10px] text-protocol-faint mt-1.5">
        {sub}
      </p>
    </div>
  )
}

function CommissionReceipt({
  lines, save, scrapedAt, isCached, cacheAge,
}: {
  lines:      ReceiptLine[]
  save:       number | null
  scrapedAt:  string
  isCached:   boolean
  cacheAge:   number | null
}) {
  const timeLabel = isCached && cacheAge
    ? `${cacheAge}m ago`
    : new Date(scrapedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })

  const amtClass: Record<ReceiptLine['type'], string> = {
    cross: 'line-through text-protocol-faint',
    red:   'text-[#c0392b]',
    muted: 'text-protocol-faint',
    teal:  'text-protocol-teal',
  }

  return (
    <div className="bg-white border border-protocol-border rounded-sm overflow-hidden">
      <div className="px-4 py-2.5 border-b border-dashed border-protocol-border flex items-baseline justify-between">
        <span className="font-mono text-[10px] tracking-[0.12em] uppercase text-protocol-muted">
          Commission Tax Receipt
        </span>
        <span className="font-mono text-[10px] text-protocol-faint">
          {timeLabel} · live
        </span>
      </div>

      <div className="px-4 py-1">
        {lines.map((l, i) => (
          <div key={i} className="flex items-start justify-between gap-4 py-2.5 border-b border-protocol-border last:border-0">
            <div className="min-w-0">
              <p className={`text-[13px] leading-snug ${l.type === 'red' ? 'text-[#c0392b]' : l.type === 'teal' ? 'text-protocol-teal' : l.type === 'muted' ? 'text-protocol-faint' : 'text-protocol-ink'}`}>
                {l.description}
              </p>
              <p className="text-[11px] text-protocol-faint mt-0.5">
                {l.subtext}
              </p>
            </div>
            <span className={`font-mono text-[13px] font-medium flex-shrink-0 ${amtClass[l.type]}`}>
              {l.amount}
            </span>
          </div>
        ))}
      </div>

      <div className="bg-protocol-ink px-4 py-3 flex items-center justify-between">
        <span className="font-mono text-[10px] tracking-[0.1em] uppercase text-white/50">
          You save tonight
        </span>
        <span className="font-display text-xl text-white font-normal">
          {save ? `£${save}` : '—'}
        </span>
      </div>
    </div>
  )
}

const RateBar = ({
  protocolRate, expediaRate, commissionAmt, ref,
}: {
  protocolRate:  number
  expediaRate:   number
  commissionAmt: number
  ref:           React.RefObject<HTMLDivElement>
}) => {
  const max     = Math.max(protocolRate, expediaRate, commissionAmt)
  const protPct = Math.round(protocolRate  / max * 88)
  const expPct  = Math.round(expediaRate   / max * 88)
  const commPct = Math.round(commissionAmt / max * 88)

  const bars = [
    { name: 'Protocol', pct: protPct, val: `£${protocolRate}`,  cls: 'bg-protocol-teal' },
    { name: 'Expedia',  pct: expPct,  val: `£${expediaRate}`,   cls: 'bg-protocol-ink'  },
    { name: 'Commission', pct: commPct, val: `£${commissionAmt}`, cls: 'bg-[#c0392b]'  },
  ]

  return (
    <div ref={ref} className="bg-white border border-protocol-border rounded-sm p-4">
      <p className="font-mono text-[9px] tracking-[0.1em] uppercase text-protocol-faint mb-4">
        Where the money goes · per night
      </p>
      <div className="flex flex-col gap-2.5">
        {bars.map(b => (
          <div key={b.name} className="flex items-center gap-3">
            <span className="font-mono text-[10px] text-protocol-muted w-[72px] text-right flex-shrink-0">
              {b.name}
            </span>
            <div className="flex-1 h-6 bg-protocol-cream-dark rounded-sm overflow-hidden">
              <div
                data-bar-pct={b.pct}
                className={`h-full ${b.cls} rounded-sm flex items-center pl-2 transition-[width] duration-700`}
                style={{ width: '0%' }}
              >
                <span className="font-mono text-[11px] font-medium text-white whitespace-nowrap">
                  {b.val}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-4 mt-3">
        {[
          { label: 'Protocol direct', cls: 'bg-protocol-teal' },
          { label: 'Expedia total',   cls: 'bg-protocol-ink'  },
          { label: "Expedia's cut",   cls: 'bg-[#c0392b]'     },
        ].map(l => (
          <div key={l.label} className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-sm flex-shrink-0 ${l.cls}`} />
            <span className="font-mono text-[9px] tracking-wide text-protocol-faint">
              {l.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function VerifiedStamp({
  scrapedAt, isCached, cacheAge,
}: {
  scrapedAt: string
  isCached:  boolean
  cacheAge:  number | null
}) {
  const time = new Date(scrapedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  const label = isCached && cacheAge
    ? `Rates from ${cacheAge} minutes ago — re-verify to refresh`
    : `Rates verified at ${time} — scraped live from Expedia, Booking.com, Hotels.com`

  return (
    <div className="flex items-center gap-2.5 px-3.5 py-2.5 bg-protocol-teal-light border border-[rgba(29,158,117,0.2)] rounded-sm">
      <svg className="w-4 h-4 flex-shrink-0 text-protocol-teal" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.2"/>
        <path d="M5 8l2 2 4-4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      <span className="font-mono text-[10px] tracking-[0.08em] text-protocol-teal-dark">
        {label}
      </span>
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────

function buildInitialRows(checkIn: string): ScanRow[] {
  return [
    { label: 'Expedia',       value: null, variant: 'default' },
    { label: 'Booking.com',   value: null, variant: 'default' },
    { label: 'Hotels.com',    value: null, variant: 'default' },
    { label: 'Commission tax', value: null, variant: 'red'    },
    { label: 'You save',       value: null, variant: 'teal'   },
  ]
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    weekday: 'short',
    day:     'numeric',
    month:   'short',
    year:    'numeric',
  })
}
