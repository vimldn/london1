'use client'

// components/concierge/NLConcierge.tsx
// ============================================================
// THE LONDON PROTOCOL — Natural Language Concierge
// Next.js 15 | Client Component | Wires to semantic-search SA
// ============================================================

import { useState, useRef, useEffect, useTransition, useCallback } from 'react'
import { useRouter }              from 'next/navigation'
import { semanticSearch, trackPropertyClick } from '@/app/actions/semantic-search'
import type { PropertyResult, SearchResponse, ParsedIntent } from '@/app/actions/semantic-search'
import { PropertyCard }           from './PropertyCard'
import { IntentChips }            from './IntentChips'

// ── Placeholder rotation ──────────────────────────────────────

const PLACEHOLDERS = [
  'I want a converted warehouse in East London with a reading nook and circadian lighting.',
  'Quiet luxury. Former Victorian printworks. Bermondsey. No background music.',
  'Somewhere a digital nomad can actually work — proper desk, fast fibre, cold brew on tap.',
  'A church conversion south of the river. Romantic. Under £200 a night.',
  'The kind of place only locals know. Former railway arch. Shoreditch or Hackney.',
]

// ── Component ─────────────────────────────────────────────────

export function NLConcierge() {
  const router                        = useRouter()
  const [query, setQuery]             = useState('')
  const [results, setResults]         = useState<SearchResponse | null>(null)
  const [intent, setIntent]           = useState<ParsedIntent | null>(null)
  const [error, setError]             = useState<string | null>(null)
  const [isPending, startTransition]  = useTransition()
  const textareaRef                   = useRef<HTMLTextAreaElement>(null)
  const placeholderRef                = useRef<HTMLSpanElement>(null)
  const placeholderTimerRef           = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [focused, setFocused]         = useState(false)

  // ── Animated placeholder ────────────────────────────────────

  useEffect(() => {
    if (query || focused) return

    let idx     = 0
    let charIdx = 0
    let dir     = 1
    let active  = true

    function tick() {
      if (!active || !placeholderRef.current) return
      const text = PLACEHOLDERS[idx]

      if (dir === 1) {
        charIdx++
        placeholderRef.current.textContent = text.slice(0, charIdx)
        if (charIdx >= text.length) {
          dir = -1
          placeholderTimerRef.current = setTimeout(tick, 1800)
          return
        }
      } else {
        charIdx--
        placeholderRef.current.textContent = text.slice(0, charIdx)
        if (charIdx <= 0) {
          idx = (idx + 1) % PLACEHOLDERS.length
          dir = 1
          placeholderTimerRef.current = setTimeout(tick, 400)
          return
        }
      }

      const delay = dir === 1 ? Math.random() * 30 + 28 : 14
      placeholderTimerRef.current = setTimeout(tick, delay)
    }

    tick()
    return () => {
      active = false
      if (placeholderTimerRef.current) clearTimeout(placeholderTimerRef.current)
      if (placeholderRef.current) placeholderRef.current.textContent = ''
    }
  }, [query, focused])

  // ── Auto-resize textarea ────────────────────────────────────

  const handleInput = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value
    setQuery(val)

    const el = textareaRef.current
    if (el) {
      el.style.height = 'auto'
      el.style.height = `${el.scrollHeight}px`
    }
  }, [])

  // ── Keyboard submit ─────────────────────────────────────────

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSearch()
    }
  }

  // ── Search ──────────────────────────────────────────────────

  const handleSearch = () => {
    if (!query.trim() || isPending) return
    setError(null)

    startTransition(async () => {
      try {
        const response = await semanticSearch({ query: query.trim(), limit: 8 })
        setResults(response)
        setIntent(response.parsedIntent)
      } catch (err) {
        setError('Search failed — please try again.')
        console.error('[Concierge] Search error:', err)
      }
    })
  }

  const handleSuggestion = (text: string) => {
    setQuery(text)
    if (textareaRef.current) {
      textareaRef.current.value = text
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
      textareaRef.current.focus()
    }
  }

  const handleCardClick = async (propertyId: string, slug: string) => {
    if (results?.queryId) {
      await trackPropertyClick(results.queryId, propertyId)
    }
    router.push(`/stay/${slug}`)
  }

  return (
    <section className="w-full max-w-3xl mx-auto px-4 lg:px-0">

      {/* Heading */}
      <div className="mb-6">
        <p className="font-mono text-[10px] tracking-[0.14em] uppercase text-protocol-teal mb-2">
          Natural Language Concierge
        </p>
        <h2 className="font-display text-3xl font-normal text-protocol-ink leading-tight">
          Tell us the <em className="italic text-protocol-gold">experience</em> you want.
        </h2>
      </div>

      {/* Search shell */}
      <div
        className={[
          'bg-white border rounded-sm overflow-hidden transition-all duration-150',
          focused
            ? 'border-protocol-ink shadow-[0_0_0_3px_rgba(26,26,24,0.06)]'
            : 'border-protocol-border',
        ].join(' ')}
      >
        {/* Input row */}
        <div className="flex items-start gap-0">
          {/* Loupe */}
          <div className="pl-4 pr-3 pt-[15px] flex-shrink-0 text-protocol-faint">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.2"/>
              <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
          </div>

          {/* Textarea + animated placeholder */}
          <div className="flex-1 relative">
            {!query && (
              <span
                ref={placeholderRef}
                aria-hidden
                className="pointer-events-none absolute top-0 left-0 pt-[14px] pr-3 font-sans text-[15px] font-light text-protocol-faint leading-relaxed"
              />
            )}
            <textarea
              ref={textareaRef}
              rows={1}
              value={query}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              className={[
                'w-full border-none outline-none resize-none bg-transparent',
                'font-sans text-[15px] font-light text-protocol-ink leading-relaxed',
                'pt-[14px] pb-[14px] pr-3 min-h-[52px] max-h-[140px]',
              ].join(' ')}
              aria-label="Describe the experience you want"
            />
          </div>

          {/* Search button */}
          <button
            onClick={handleSearch}
            disabled={isPending || !query.trim()}
            className={[
              'self-end mb-[10px] mr-3 px-4 py-[7px] rounded-sm flex-shrink-0',
              'font-mono text-[10px] tracking-[0.12em] uppercase transition-all',
              isPending
                ? 'bg-protocol-teal text-white cursor-wait'
                : 'bg-protocol-ink text-white hover:bg-[#2d2d2a] active:scale-95 disabled:opacity-40',
            ].join(' ')}
          >
            {isPending ? 'Searching…' : 'Search'}
          </button>
        </div>

        {/* Intent chips */}
        {intent && <IntentChips intent={intent} />}
      </div>

      {/* Suggestion pills */}
      {!results && (
        <div className="mt-3 flex flex-wrap gap-2 items-center">
          <span className="font-mono text-[10px] tracking-[0.1em] uppercase text-protocol-faint flex-shrink-0">
            Try →
          </span>
          {[
            { label: 'Converted warehouse · East London · reading nook', query: 'A converted warehouse in East London with circadian lighting and a reading nook' },
            { label: 'Quiet luxury · Bermondsey · printworks',           query: 'Quiet luxury in Bermondsey, former Victorian printworks, no ambient music' },
            { label: 'Digital nomad · Shoreditch · studio desk',         query: 'Digital nomad setup in Shoreditch with a proper studio desk and cold brew on tap' },
            { label: 'Church conversion · romantic · South London',      query: 'Former church conversion, romantic, south London, under £220 a night' },
          ].map((s) => (
            <button
              key={s.label}
              onClick={() => handleSuggestion(s.query)}
              className="text-xs text-protocol-muted bg-white border border-protocol-border rounded-full px-3 py-1 hover:border-protocol-muted hover:text-protocol-ink transition-colors whitespace-nowrap"
            >
              {s.label}
            </button>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <p className="mt-4 font-mono text-[11px] text-red-600 tracking-wide">{error}</p>
      )}

      {/* Results */}
      {results && (
        <div className="mt-8">
          <div className="flex items-baseline justify-between mb-4">
            <span className="font-mono text-[10px] tracking-[0.12em] uppercase text-protocol-faint">
              Matched stays
            </span>
            <span className="font-display text-lg font-normal text-protocol-ink">
              {results.totalFound > 0
                ? `${results.results.length} of ${results.totalFound} properties matched`
                : 'No properties matched'}
            </span>
          </div>

          <div className="flex flex-col gap-3">
            {results.results.map((property, i) => (
              <PropertyCard
                key={property.id}
                property={property}
                index={i}
                onClick={() => handleCardClick(property.id, property.slug)}
              />
            ))}
          </div>

          {results.results.length === 0 && (
            <div className="text-center py-12 text-protocol-faint">
              <p className="font-display text-xl italic text-protocol-muted">
                No stays matched that intent.
              </p>
              <p className="font-mono text-[11px] tracking-wide mt-2">
                Try rephrasing — or remove a filter.
              </p>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
