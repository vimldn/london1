'use client'

// components/concierge/PropertyCard.tsx
// ============================================================

import { useEffect, useRef } from 'react'
import type { PropertyResult } from '@/app/actions/semantic-search'
import { generatePropertySchema } from '@/lib/schema/property-jsonld'

interface PropertyCardProps {
  property: PropertyResult
  index:    number
  onClick:  () => void
}

export function PropertyCard({ property: p, index, onClick }: PropertyCardProps) {
  const fillRef   = useRef<HTMLDivElement>(null)
  const simPct    = Math.round(p.similarity * 100)
  const saved     = p.otaRateCache ? Math.round(p.otaRateCache - p.protocolNightly) : null
  const savedPct  = p.otaRateCache ? Math.round(saved! / p.otaRateCache * 100) : null
  const commAmt   = p.otaRateCache ? Math.round(p.otaRateCache * (p.commissionTaxPct / 100)) : null

  useEffect(() => {
    const timer = setTimeout(() => {
      if (fillRef.current) fillRef.current.style.width = `${simPct}%`
    }, 200 + index * 80)
    return () => clearTimeout(timer)
  }, [simPct, index])

  const vibeLabel = p.primaryVibe
    ? p.primaryVibe.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    : null

  const pastLifeLabel = p.pastLife
    ? p.pastLife.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    : null

  // Inject JSON-LD per card (for crawlers hitting the search results page)
  const jsonLd = generatePropertySchema({ property: p })

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <article
        onClick={onClick}
        className={[
          'bg-white border border-protocol-border rounded-sm overflow-hidden',
          'hover:border-protocol-border-strong transition-colors cursor-pointer',
          'animate-cardIn',
        ].join(' ')}
        style={{ animationDelay: `${index * 80}ms` }}
      >
        {/* Similarity bar */}
        <div className="h-[2px] bg-protocol-cream-dark relative">
          <div
            ref={fillRef}
            className="absolute inset-y-0 left-0 bg-protocol-teal transition-[width] duration-500"
            style={{ width: '0%' }}
          />
        </div>

        {/* Card body */}
        <div className="grid grid-cols-[1fr_auto] gap-4 p-5 items-start">
          <div className="min-w-0">
            {/* Badges */}
            <div className="flex flex-wrap gap-1.5 mb-2">
              <Badge variant="borough">{p.borough.replace(/_/g, ' ')}</Badge>
              {pastLifeLabel && <Badge variant="salvage">{pastLifeLabel}</Badge>}
              {vibeLabel     && <Badge variant="vibe">{vibeLabel}</Badge>}
              {p.salvagedStayScore && p.salvagedStayScore >= 8 && (
                <Badge variant="gold">Salvaged Stay</Badge>
              )}
            </div>

            {/* Name */}
            <h3 className="font-display text-xl font-normal text-protocol-ink leading-tight mb-1">
              {p.name}
            </h3>

            {/* Tagline */}
            {p.tagline && (
              <p className="text-[13px] font-light italic text-protocol-muted leading-relaxed mb-3">
                {p.tagline}
              </p>
            )}

            {/* Feature tags */}
            <div className="flex flex-wrap gap-1.5">
              {p.matchedTags.map(t => (
                <span
                  key={t}
                  className="font-mono text-[9px] tracking-wide bg-protocol-teal text-white px-1.5 py-[2px] rounded-[2px]"
                >
                  {t}
                </span>
              ))}
              {p.retainedFeatures.slice(0, 2).map(f => (
                <span
                  key={f}
                  className="font-mono text-[9px] tracking-wide bg-protocol-teal-light text-protocol-teal-dark px-1.5 py-[2px] rounded-[2px]"
                >
                  {f}
                </span>
              ))}
            </div>
          </div>

          {/* Rate block */}
          <div className="text-right flex-shrink-0 pl-2">
            <p className="font-mono text-[9px] tracking-[0.1em] uppercase text-protocol-teal mb-0.5">
              Protocol direct
            </p>
            <p className="font-display text-2xl font-normal text-protocol-ink">
              £{p.protocolNightly}
            </p>
            {p.otaRateCache && (
              <p className="text-[11px] text-protocol-faint line-through mt-0.5">
                £{Math.round(p.otaRateCache)} Expedia
              </p>
            )}
          </div>
        </div>

        {/* Commission tax bar */}
        {saved && saved > 0 && commAmt && (
          <div className="bg-[#fdf0ef] border-t border-[rgba(192,57,43,0.12)] px-5 py-2 flex items-center justify-between">
            <span className="font-mono text-[10px] tracking-wide text-[#c0392b]">
              £{commAmt} Expedia commission tax avoided
            </span>
            <span className="font-mono text-[10px] tracking-wide text-protocol-teal font-medium">
              Save £{saved} tonight ({savedPct}%)
            </span>
          </div>
        )}
      </article>
    </>
  )
}

// ── Badge ─────────────────────────────────────────────────────

type BadgeVariant = 'borough' | 'salvage' | 'vibe' | 'gold'

const badgeStyles: Record<BadgeVariant, string> = {
  borough: 'bg-protocol-cream-dark text-protocol-muted',
  salvage: 'bg-[#e8e0f0] text-[#4a2d82]',
  vibe:    'bg-protocol-gold-light text-[#7a5800]',
  gold:    'bg-[#fff3cd] text-[#7a5800]',
}

function Badge({ variant, children }: { variant: BadgeVariant; children: React.ReactNode }) {
  return (
    <span
      className={[
        'font-mono text-[9px] tracking-[0.08em] uppercase px-1.5 py-[2px] rounded-[2px]',
        badgeStyles[variant],
      ].join(' ')}
    >
      {children}
    </span>
  )
}


// ============================================================
// components/concierge/IntentChips.tsx
// ============================================================

import type { ParsedIntent } from '@/app/actions/semantic-search'

interface IntentChipsProps {
  intent: ParsedIntent
}

type ChipType = 'borough' | 'vibe' | 'past' | 'tag'

interface Chip {
  type:  ChipType
  label: string
}

const chipStyles: Record<ChipType, string> = {
  borough: 'bg-protocol-ink text-white',
  vibe:    'bg-protocol-gold-light text-[#7a5800]',
  past:    'bg-[#e8e0f0] text-[#4a2d82]',
  tag:     'bg-protocol-teal-light text-protocol-teal-dark',
}

const chipTypeLabel: Record<ChipType, string> = {
  borough: 'area',
  vibe:    'vibe',
  past:    'past life',
  tag:     'feature',
}

export function IntentChips({ intent }: IntentChipsProps) {
  const chips: Chip[] = [
    ...(intent.borough  ? [{ type: 'borough' as const, label: intent.borough.replace(/_/g,' ') }] : []),
    ...intent.vibes.slice(0, 1).map(v => ({ type: 'vibe' as const, label: v.replace(/_/g,' ') })),
    ...(intent.pastLife ? [{ type: 'past' as const, label: intent.pastLife.replace(/_/g,' ') }] : []),
    ...intent.tags.slice(0, 3).map(t => ({ type: 'tag' as const, label: t })),
  ]

  if (chips.length === 0) return null

  return (
    <div className="border-t border-protocol-border px-3.5 py-2 flex flex-wrap gap-1.5">
      {chips.map((c, i) => (
        <span
          key={`${c.type}-${c.label}`}
          className={[
            'inline-flex items-center gap-1 font-mono text-[10px] tracking-[0.06em] px-2 py-[3px] rounded-[2px]',
            'animate-chipIn',
            chipStyles[c.type],
          ].join(' ')}
          style={{ animationDelay: `${i * 60 + 80}ms`, opacity: 0 }}
        >
          <span className="opacity-50 font-normal text-[9px]">{chipTypeLabel[c.type]}</span>
          {c.label}
        </span>
      ))}
    </div>
  )
}
