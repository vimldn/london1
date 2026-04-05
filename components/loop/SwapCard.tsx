'use client'

// components/loop/SwapCard.tsx
// ============================================================
// Accordion card for the /loop listing page.
// Expands inline — no navigation until "Book this loop".
// ============================================================

import { useState, useRef, useEffect } from 'react'
import Link                             from 'next/link'
import type { NeighbourhoodSwap }       from '@/types/loop'

interface SwapCardProps {
  swap:  NeighbourhoodSwap
  index: number
}

export function SwapCard({ swap, index }: SwapCardProps) {
  const [open, setOpen]     = useState(index === 0)
  const detailRef           = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState<number | undefined>(index === 0 ? undefined : 0)

  useEffect(() => {
    if (!detailRef.current) return
    if (open) {
      setHeight(detailRef.current.scrollHeight)
      // After transition, free-size so content can grow
      const t = setTimeout(() => setHeight(undefined), 320)
      return () => clearTimeout(t)
    } else {
      // Snapshot current height before collapsing (prevents jump)
      setHeight(detailRef.current.scrollHeight)
      requestAnimationFrame(() => setHeight(0))
    }
  }, [open])

  const totalNights   = swap.nights_a + swap.nights_b
  const separateTotal = swap.property_a.protocol_nightly * swap.nights_a +
                        swap.property_b.protocol_nightly * swap.nights_b
  const saving        = Math.round(separateTotal - swap.loop_rate)

  const propA = swap.property_a
  const propB = swap.property_b

  return (
    <article
      className={[
        'bg-white border rounded-sm overflow-hidden transition-[border-color] duration-150',
        open ? 'border-protocol-ink' : 'border-protocol-border hover:border-protocol-border-strong',
      ].join(' ')}
    >
      {/* Card top — always visible, clickable */}
      <button
        className="w-full text-left px-5 pt-5 pb-4 cursor-pointer"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
      >
        {/* Name + thesis */}
        <h2 className="font-display text-xl font-normal mb-1">{swap.name}</h2>
        {swap.contrast_thesis && (
          <p className="font-display text-[13px] italic text-protocol-muted mb-4 leading-relaxed">
            {swap.contrast_thesis}
          </p>
        )}

        {/* Property connector */}
        <div className="flex items-stretch gap-0 mb-4">
          <PropertyBlock property={propA} nights={swap.nights_a} nightsLabel={`Nights 1–${swap.nights_a}`} />
          <ConnectorCol />
          <PropertyBlock property={propB} nights={swap.nights_b} nightsLabel={`Nights ${swap.nights_a + 1}–${totalNights}`} />
        </div>

        {/* Meta row */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1.5">
            <LoopTag variant="neutral">{totalNights} nights total</LoopTag>
            {saving > 0 && <LoopTag variant="teal">Save £{saving} vs. separate</LoopTag>}
            <LoopTag variant="purple">
              {formatBorough(propA.borough)} + {formatBorough(propB.borough)}
            </LoopTag>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="font-mono text-[9px] tracking-[0.08em] uppercase text-protocol-teal mb-0.5">
              Loop rate
            </p>
            <p className="font-display text-xl font-normal">
              £{swap.loop_rate.toLocaleString()}
            </p>
            <p className="text-[11px] text-protocol-faint line-through">
              £{separateTotal.toLocaleString()} separately
            </p>
          </div>
        </div>

        {/* Expand chevron */}
        <div className={`flex justify-center mt-3 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-protocol-faint">
            <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </button>

      {/* Expandable detail */}
      <div
        ref={detailRef}
        style={{ height, overflow: 'hidden', transition: 'height 0.3s cubic-bezier(0.23,1,0.32,1)' }}
      >
        <div className="border-t border-protocol-border bg-protocol-cream px-5 py-4">
          {/* Itinerary timeline (condensed) */}
          <div className="flex flex-col gap-0 mb-5">
            <TimelineStop
              days={`Days 1–${swap.nights_a} · ${formatBorough(propA.borough)}`}
              name={propA.name}
              meta={formatPastLife(propA.past_lives?.[0]?.former_use)}
              tags={(propA.property_tags ?? []).slice(0, 4).map((t: any) => t.experience_tags?.tag).filter(Boolean)}
              hasLine
            />
            <SwapDivider label={swap.recommended_split ?? `Swap after night ${swap.nights_a} · via Overground`} />
            <TimelineStop
              days={`Days ${swap.nights_a + 1}–${totalNights} · ${formatBorough(propB.borough)}`}
              name={propB.name}
              meta={formatPastLife(propB.past_lives?.[0]?.former_use)}
              tags={(propB.property_tags ?? []).slice(0, 4).map((t: any) => t.experience_tags?.tag).filter(Boolean)}
              hasLine={false}
            />
          </div>

          {/* Shared thread */}
          {swap.shared_thread && (
            <div className="bg-white border border-protocol-border rounded-sm px-4 py-3 mb-4">
              <p className="font-mono text-[9px] tracking-[0.1em] uppercase text-protocol-faint mb-2">
                Shared thread
              </p>
              <p className="font-display text-[13px] italic text-protocol-muted leading-relaxed">
                {swap.shared_thread}
              </p>
            </div>
          )}

          {/* Book bar */}
          <div className="bg-protocol-ink rounded-sm px-4 py-3 flex items-center justify-between gap-4">
            <div>
              <div className="flex items-baseline gap-2.5 mb-1">
                <span className="font-display text-xl text-white font-normal">
                  £{swap.loop_rate.toLocaleString()}
                </span>
                {saving > 0 && (
                  <span className="font-mono text-[9px] uppercase tracking-wide bg-protocol-teal text-white px-1.5 py-0.5 rounded-sm">
                    Save £{saving}
                  </span>
                )}
              </div>
              <p className="font-mono text-[9px] tracking-[0.08em] uppercase text-white/40">
                {totalNights} nights · Protocol direct · zero commission
              </p>
            </div>
            <Link
              href={`/loop/${swap.slug}`}
              className="font-mono text-[10px] tracking-[0.12em] uppercase px-4 py-2 border border-white/30 text-white rounded-sm hover:bg-white/10 transition-colors whitespace-nowrap"
              onClick={e => e.stopPropagation()}
            >
              View + book
            </Link>
          </div>
        </div>
      </div>
    </article>
  )
}

// ── Sub-components ────────────────────────────────────────────

function PropertyBlock({
  property, nights, nightsLabel,
}: {
  property: any; nights: number; nightsLabel: string
}) {
  const pastLife = property.past_lives?.[0]?.former_use
  return (
    <div className="flex-1 min-w-0">
      <div className="border border-protocol-border rounded-sm p-3 h-full">
        <p className="font-mono text-[9px] tracking-[0.1em] uppercase text-protocol-faint mb-1">
          {formatBorough(property.borough)}
        </p>
        <p className="font-display text-[15px] font-normal leading-tight mb-1">
          {property.name}
        </p>
        {pastLife && (
          <p className="text-[11px] text-protocol-muted">
            Former {formatPastLife(pastLife).toLowerCase()}
          </p>
        )}
        <p className="font-mono text-[9px] tracking-[0.08em] uppercase text-protocol-teal mt-2">
          {nightsLabel}
        </p>
      </div>
    </div>
  )
}

function ConnectorCol() {
  return (
    <div className="w-12 flex-shrink-0 flex flex-col items-center justify-center gap-0 px-1">
      <div className="w-px flex-1 bg-protocol-border" />
      <div className="w-7 h-7 rounded-full bg-protocol-ink flex items-center justify-center flex-shrink-0 my-1">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M6 2v8M2 6l4 4 4-4" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
      <div className="w-px flex-1 bg-protocol-border" />
    </div>
  )
}

function TimelineStop({
  days, name, meta, tags, hasLine,
}: {
  days: string; name: string; meta: string; tags: string[]; hasLine: boolean
}) {
  return (
    <div className="flex gap-4 items-start">
      <div className="flex flex-col items-center w-6 flex-shrink-0 pt-1">
        <div className={`w-2.5 h-2.5 rounded-full border-2 border-protocol-ink ${hasLine ? 'bg-protocol-ink' : 'bg-protocol-teal border-protocol-teal'}`} />
        {hasLine && <div className="w-px flex-1 min-h-8 bg-protocol-border mt-1" />}
      </div>
      <div className="flex-1 pb-4">
        <p className="font-mono text-[9px] tracking-[0.1em] uppercase text-protocol-faint mb-1">{days}</p>
        <p className="font-display text-base font-normal mb-0.5">{name}</p>
        <p className="text-[12px] text-protocol-muted mb-2">{meta}</p>
        <div className="flex flex-wrap gap-1">
          {tags.map(t => (
            <span key={t} className="font-mono text-[9px] tracking-wide bg-protocol-teal-light text-protocol-teal-dark px-1.5 py-0.5 rounded-sm">
              {t}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

function SwapDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 py-1 ml-10">
      <div className="flex-1 h-px bg-protocol-border" />
      <span className="font-mono text-[9px] tracking-[0.08em] uppercase text-protocol-faint whitespace-nowrap">
        {label}
      </span>
      <div className="flex-1 h-px bg-protocol-border" />
    </div>
  )
}

function LoopTag({
  children, variant,
}: {
  children: React.ReactNode
  variant: 'neutral' | 'teal' | 'purple'
}) {
  const cls = {
    neutral: 'bg-protocol-cream-dark text-protocol-muted',
    teal:    'bg-protocol-teal-light text-protocol-teal-dark',
    purple:  'bg-[#e8e0f0] text-[#4a2d82]',
  }[variant]
  return (
    <span className={`font-mono text-[9px] tracking-[0.08em] uppercase px-2 py-1 rounded-sm ${cls}`}>
      {children}
    </span>
  )
}

// ── Formatters ────────────────────────────────────────────────

function formatBorough(b: string) {
  return (b ?? '').split('_').map(w => w[0]?.toUpperCase() + w.slice(1)).join(' ')
}

function formatPastLife(pl: string | undefined) {
  if (!pl) return ''
  return pl.split('_').map(w => w[0].toUpperCase() + w.slice(1)).join(' ')
}


// ============================================================
// components/loop/SwapItinerary.tsx
// Full itinerary view used on /loop/[slug] page
// ============================================================

import type { NeighbourhoodSwap } from '@/types/loop'

export function SwapItinerary({
  swap,
  saving,
  totalNights,
}: {
  swap: NeighbourhoodSwap
  saving: number
  totalNights: number
}) {
  const propA = swap.property_a
  const propB = swap.property_b

  const tagsA = (propA.property_tags ?? []).map((t: any) => t.experience_tags?.tag).filter(Boolean)
  const tagsB = (propB.property_tags ?? []).map((t: any) => t.experience_tags?.tag).filter(Boolean)
  const plA   = propA.past_lives?.[0]
  const plB   = propB.past_lives?.[0]
  const vA    = propA.vibe_metrics?.[0]
  const vB    = propB.vibe_metrics?.[0]

  return (
    <div className="mb-6">
      {/* Property A */}
      <ItineraryBlock
        side="a"
        dayRange={`Days 1–${swap.nights_a}`}
        borough={formatBorough(propA.borough)}
        property={propA}
        pastLife={plA}
        vibe={vA}
        tags={tagsA}
        hasConnector
        connectorLabel={swap.recommended_split ?? `Swap after night ${swap.nights_a}`}
        nightly={propA.protocol_nightly}
        nights={swap.nights_a}
      />

      {/* Property B */}
      <ItineraryBlock
        side="b"
        dayRange={`Days ${swap.nights_a + 1}–${totalNights}`}
        borough={formatBorough(propB.borough)}
        property={propB}
        pastLife={plB}
        vibe={vB}
        tags={tagsB}
        hasConnector={false}
        nightly={propB.protocol_nightly}
        nights={swap.nights_b}
      />
    </div>
  )
}

function ItineraryBlock({
  side, dayRange, borough, property, pastLife, vibe, tags,
  hasConnector, connectorLabel, nightly, nights,
}: {
  side:           'a' | 'b'
  dayRange:       string
  borough:        string
  property:       any
  pastLife:       any
  vibe:           any
  tags:           string[]
  hasConnector:   boolean
  connectorLabel?: string
  nightly:        number
  nights:         number
}) {
  const dotCls = side === 'a'
    ? 'bg-protocol-ink border-protocol-ink'
    : 'bg-protocol-teal border-protocol-teal'

  return (
    <>
      <div className="flex gap-5 items-start">
        {/* Timeline column */}
        <div className="flex flex-col items-center w-8 flex-shrink-0 pt-1">
          <div className={`w-3 h-3 rounded-full border-2 flex-shrink-0 ${dotCls}`} />
          {hasConnector && <div className="w-px flex-1 min-h-24 bg-protocol-border mt-1" />}
        </div>

        {/* Content */}
        <div className={`flex-1 ${hasConnector ? 'pb-0' : 'pb-2'}`}>
          <p className="font-mono text-[9px] tracking-[0.1em] uppercase text-protocol-faint mb-1">
            {dayRange} · {borough}
          </p>
          <h2 className="font-display text-2xl font-normal mb-1">{property.name}</h2>
          {property.tagline && (
            <p className="text-[13px] font-light italic text-protocol-muted mb-3 leading-relaxed">
              {property.tagline}
            </p>
          )}

          {/* Past life */}
          {pastLife && (
            <div className="bg-[#e8e0f0] border border-[rgba(74,45,130,0.15)] rounded-sm px-3 py-2 mb-3">
              <p className="font-mono text-[9px] tracking-[0.08em] uppercase text-[#4a2d82] mb-0.5">
                Past life
              </p>
              <p className="text-[13px] text-[#4a2d82]">
                Former {formatPastLife(pastLife.former_use).toLowerCase()}
                {pastLife.era ? ` · ${pastLife.era}` : ''}
                {pastLife.heritage_listing ? ` · ${pastLife.heritage_listing} listed` : ''}
              </p>
              {pastLife.retained_features?.length > 0 && (
                <p className="text-[11px] text-[#6b4599] mt-1">
                  Retained: {pastLife.retained_features.slice(0, 3).join(', ')}
                </p>
              )}
            </div>
          )}

          {/* Vibe */}
          {vibe && (
            <p className="font-mono text-[10px] tracking-[0.08em] uppercase text-protocol-gold mb-3">
              {formatVibe(vibe.vibe)} · {vibe.score}/100
            </p>
          )}

          {/* Feature tags */}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {tags.map((t: string) => (
                <span key={t} className="font-mono text-[9px] tracking-wide bg-protocol-teal-light text-protocol-teal-dark px-1.5 py-0.5 rounded-sm">
                  {t}
                </span>
              ))}
            </div>
          )}

          {/* Nightly rate */}
          <div className="flex items-baseline gap-2">
            <span className="font-display text-lg text-protocol-teal">
              £{nightly} / night
            </span>
            <span className="font-mono text-[10px] text-protocol-faint tracking-wide">
              × {nights} nights = £{nightly * nights}
            </span>
          </div>
        </div>
      </div>

      {/* Connector */}
      {hasConnector && connectorLabel && (
        <div className="flex items-center gap-3 ml-13 pl-[52px] py-3">
          <div className="flex-1 h-px bg-protocol-border" />
          <span className="font-mono text-[9px] tracking-[0.08em] uppercase text-protocol-faint whitespace-nowrap">
            {connectorLabel}
          </span>
          <div className="flex-1 h-px bg-protocol-border" />
        </div>
      )}
    </>
  )
}

function formatBorough(b: string) {
  return (b ?? '').split('_').map(w => w[0]?.toUpperCase() + w.slice(1)).join(' ')
}
function formatPastLife(pl: string | undefined) {
  if (!pl) return ''
  return pl.split('_').map(w => w[0].toUpperCase() + w.slice(1)).join(' ')
}
function formatVibe(v: string) {
  return (v ?? '').split('_').map(w => w[0].toUpperCase() + w.slice(1)).join(' ')
}
