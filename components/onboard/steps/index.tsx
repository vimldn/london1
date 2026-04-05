// components/onboard/steps/TierStep.tsx
// ============================================================

'use client'
import type { StepProps } from '@/types/onboard'

const TIERS = [
  {
    id:       'core',
    name:     'Protocol Core',
    price:    299,
    rooms:    'Up to 20 rooms',
    badge:    null,
    features: [
      'Directory listing',
      'NL concierge ranking',
      'Rate verification badge',
      'Email support',
    ],
  },
  {
    id:       'plus',
    name:     'Protocol Plus',
    price:    599,
    rooms:    'Up to 80 rooms',
    badge:    'Most popular',
    badgeVariant: 'gold',
    features: [
      'Everything in Core',
      'Priority AEO ranking',
      'The Loop eligibility',
      'Monthly analytics report',
    ],
  },
  {
    id:       'elite',
    name:     'Protocol Elite',
    price:    999,
    rooms:    'Unlimited rooms',
    badge:    'New',
    badgeVariant: 'teal',
    features: [
      'Everything in Plus',
      'Pinned search results',
      'Dedicated account manager',
      'On-site vibe inspection',
    ],
  },
]

export function TierStep({ state, update, next, currentStep, totalSteps }: StepProps) {
  return (
    <>
      <StepEyebrow step={currentStep} total={totalSteps} />
      <h2 className="font-display text-3xl font-normal mb-2">Choose your membership.</h2>
      <p className="text-[14px] font-light text-protocol-muted leading-relaxed mb-7 max-w-md">
        A flat monthly subscription replaces the 25% OTA commission. Hotels pay once — guests pay less. Everyone wins except Expedia.
      </p>

      <div className="grid grid-cols-3 gap-3 mb-7">
        {TIERS.map(t => {
          const selected = state.tier === t.id
          return (
            <button
              key={t.id}
              onClick={() => update({ tier: t.id as any })}
              className={[
                'relative text-left border rounded-sm p-4 transition-all duration-150',
                selected
                  ? 'border-protocol-ink bg-protocol-cream'
                  : 'border-protocol-border bg-white hover:border-protocol-border-strong',
              ].join(' ')}
            >
              {/* Selected tick */}
              {selected && (
                <span className="absolute top-3 right-3 w-4 h-4 rounded-full bg-protocol-ink flex items-center justify-center">
                  <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                    <path d="M1.5 4L3 5.5L6.5 2.5" stroke="white" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </span>
              )}

              {/* Badge */}
              {t.badge ? (
                <span className={[
                  'inline-block font-mono text-[8px] tracking-[0.06em] uppercase px-1.5 py-0.5 rounded-sm mb-2',
                  t.badgeVariant === 'gold' ? 'bg-protocol-gold-light text-protocol-gold' : 'bg-protocol-teal-light text-protocol-teal-dark',
                ].join(' ')}>
                  {t.badge}
                </span>
              ) : <div className="h-5" />}

              <p className="font-mono text-[9px] tracking-[0.1em] uppercase text-protocol-faint mb-1.5">{t.name}</p>
              <p className="font-display text-2xl font-normal">£{t.price}</p>
              <p className="font-mono text-[9px] tracking-[0.06em] uppercase text-protocol-faint mb-3">/ month + VAT</p>

              <ul className="space-y-1">
                {t.features.map(f => (
                  <li key={f} className="flex items-start gap-1.5 text-[11px] text-protocol-muted">
                    <span className="text-protocol-teal mt-px flex-shrink-0">·</span>
                    {f}
                  </li>
                ))}
              </ul>

              <p className="font-mono text-[9px] text-protocol-faint mt-3">{t.rooms}</p>
            </button>
          )
        })}
      </div>

      <NavRow onNext={next} hasBack={false} nextLabel="Continue" step={currentStep} total={totalSteps} />
    </>
  )
}


// ============================================================
// components/onboard/steps/PropertyStep.tsx
// ============================================================

export function PropertyStep({ state, update, next, prev, currentStep, totalSteps }: StepProps) {
  return (
    <>
      <StepEyebrow step={currentStep} total={totalSteps} />
      <h2 className="font-display text-3xl font-normal mb-2">Tell us about your property.</h2>
      <p className="text-[14px] font-light text-protocol-muted leading-relaxed mb-7 max-w-md">
        This is what guests see in search results and on your listing page.
      </p>

      <Field label="Property name">
        <input
          className={inputCls}
          value={state.name}
          onChange={e => update({ name: e.target.value })}
          placeholder="The Bermondsey Loom"
        />
      </Field>

      <Field label="Tagline" hint="One sentence. Make it honest.">
        <input
          className={inputCls}
          value={state.tagline}
          onChange={e => update({ tagline: e.target.value })}
          placeholder="A Victorian textile warehouse that learned to dream."
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Borough">
          <select
            className={`${inputCls} appearance-none`}
            value={state.borough}
            onChange={e => update({ borough: e.target.value })}
          >
            <option value="">Select borough</option>
            {BOROUGHS.map(b => <option key={b}>{b}</option>)}
          </select>
        </Field>
        <Field label="Postcode">
          <input
            className={inputCls}
            value={state.postcode}
            onChange={e => update({ postcode: e.target.value })}
            placeholder="SE1 3PJ"
          />
        </Field>
      </div>

      <div className="h-px bg-protocol-border my-5" />
      <p className="font-mono text-[9px] tracking-[0.1em] uppercase text-protocol-faint mb-4">Contact details</p>

      <Field label="Contact name">
        <input
          className={inputCls}
          value={state.contactName}
          onChange={e => update({ contactName: e.target.value })}
          placeholder="Full name"
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Email">
          <input
            className={inputCls}
            type="email"
            value={state.contactEmail}
            onChange={e => update({ contactEmail: e.target.value })}
            placeholder="you@yourproperty.com"
          />
        </Field>
        <Field label="Phone (optional)">
          <input
            className={inputCls}
            type="tel"
            value={state.contactPhone}
            onChange={e => update({ contactPhone: e.target.value })}
            placeholder="+44 20 7946 0000"
          />
        </Field>
      </div>

      <NavRow onNext={next} onPrev={prev} hasBack step={currentStep} total={totalSteps} />
    </>
  )
}

const BOROUGHS = [
  'Bermondsey','Bethnal Green','Brixton','Camden','Chelsea','Clerkenwell',
  'Dalston','Deptford','Greenwich','Hackney','Hammersmith','Islington',
  'Kensington','Lambeth','Peckham','Shoreditch','Southwark','Spitalfields',
  'Tower Hamlets','Wapping','Westminster','City of London',
]


// ============================================================
// components/onboard/steps/PastLifeStep.tsx
// ============================================================

export function PastLifeStep({ state, update, next, prev, currentStep, totalSteps }: StepProps) {
  return (
    <>
      <StepEyebrow step={currentStep} total={totalSteps} />
      <h2 className="font-display text-3xl font-normal mb-2">What was this building before?</h2>
      <p className="text-[14px] font-light text-protocol-muted leading-relaxed mb-7 max-w-md">
        The Salvaged Stay profile is our strongest AEO signal. Guests search for converted spaces — and we rank for it.
      </p>

      <Field label="Former use">
        <select
          className={`${inputCls} appearance-none`}
          value={state.pastLife}
          onChange={e => update({ pastLife: e.target.value })}
        >
          <option value="">Select former use</option>
          {PAST_LIVES.map(p => <option key={p}>{p}</option>)}
        </select>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Era / period">
          <input
            className={inputCls}
            value={state.era}
            onChange={e => update({ era: e.target.value })}
            placeholder="Victorian, 1930s Art Deco…"
          />
        </Field>
        <Field label="Heritage listing">
          <select
            className={`${inputCls} appearance-none`}
            value={state.heritage}
            onChange={e => update({ heritage: e.target.value })}
          >
            <option value="">None</option>
            <option>Grade II</option>
            <option>Grade II*</option>
            <option>Grade I</option>
          </select>
        </Field>
      </div>

      <Field label="Retained features" hint="Comma-separated">
        <input
          className={inputCls}
          value={state.retainedFeatures}
          onChange={e => update({ retainedFeatures: e.target.value })}
          placeholder="Original vault door, Victorian terrazzo, exposed riveted steel"
        />
      </Field>

      <Field label="Salvage story" hint="2–3 sentences. Used for AEO rich results.">
        <textarea
          className={`${inputCls} resize-y`}
          rows={3}
          value={state.salvageStory}
          onChange={e => update({ salvageStory: e.target.value })}
          placeholder="This building operated as a working textile warehouse from 1887 until 1991. The original loom frames remain in the ground floor common room…"
        />
      </Field>

      <NavRow onNext={next} onPrev={prev} hasBack step={currentStep} total={totalSteps} />
    </>
  )
}

const PAST_LIVES = [
  'Bank','Brewery','Church','Cinema','Courthouse','Factory',
  'Fire Station','Hospital','Library','Market Hall','Post Office',
  'Power Station','Printworks','Railway Arch','School',
  'Telephone Exchange','Victorian Mansion','Warehouse',
]


// ============================================================
// components/onboard/steps/VibeStep.tsx
// ============================================================

export function VibeStep({ state, update, next, prev, currentStep, totalSteps }: StepProps) {
  const toggleTag = (tag: string) => {
    const has = state.tags.includes(tag)
    update({ tags: has ? state.tags.filter(t => t !== tag) : [...state.tags, tag] })
  }

  return (
    <>
      <StepEyebrow step={currentStep} total={totalSteps} />
      <h2 className="font-display text-3xl font-normal mb-2">What's the energy of this place?</h2>
      <p className="text-[14px] font-light text-protocol-muted leading-relaxed mb-7 max-w-md">
        Pick the vibe that most honestly describes the experience — not the one you wish it were.
      </p>

      <Field label="Primary vibe">
        <div className="grid grid-cols-2 gap-2 mt-1">
          {VIBES.map(v => (
            <button
              key={v.id}
              onClick={() => update({ vibe: v.id })}
              className={[
                'text-left border rounded-sm p-3 transition-all duration-150',
                state.vibe === v.id
                  ? 'border-protocol-ink bg-protocol-cream'
                  : 'border-protocol-border bg-white hover:border-protocol-border-strong',
              ].join(' ')}
            >
              <p className="font-mono text-[9px] tracking-[0.08em] uppercase text-protocol-ink mb-0.5">{v.name}</p>
              <p className="text-[11px] text-protocol-faint">{v.desc}</p>
            </button>
          ))}
        </div>
      </Field>

      <Field label="Feature tags" hint="Select everything that genuinely applies.">
        <div className="flex flex-wrap gap-1.5 mt-1.5">
          {EXPERIENCE_TAGS.map(tag => {
            const on = state.tags.includes(tag)
            return (
              <button
                key={tag}
                onClick={() => toggleTag(tag)}
                className={[
                  'font-mono text-[9px] tracking-[0.06em] uppercase px-2 py-1 border rounded-sm',
                  'transition-all duration-120',
                  on
                    ? 'bg-protocol-teal border-protocol-teal text-white'
                    : 'border-protocol-border bg-white text-protocol-muted hover:border-protocol-border-strong',
                ].join(' ')}
              >
                {tag}
              </button>
            )
          })}
        </div>
      </Field>

      <NavRow onNext={next} onPrev={prev} hasBack step={currentStep} total={totalSteps} />
    </>
  )
}

const VIBES = [
  { id: 'quiet_luxury',       name: 'Quiet Luxury',        desc: 'Understated. Nothing to prove.'   },
  { id: 'high_energy',        name: 'High Energy',          desc: 'People come for the scene.'       },
  { id: 'digital_nomad',      name: 'Digital Nomad',        desc: 'Fast fibre. Proper desk.'         },
  { id: 'romantic_retreat',   name: 'Romantic Retreat',     desc: 'Two people. No interruptions.'   },
  { id: 'creative_residency', name: 'Creative Residency',   desc: 'Studio energy. Analogue calm.'   },
  { id: 'hidden_locals_only', name: 'Hidden / Locals Only', desc: 'No influencers. Just regulars.'  },
]

const EXPERIENCE_TAGS = [
  'reading-nook','circadian-lighting','warehouse-ceiling','ghost-sign-wall',
  'vault-bedroom','railway-arch-room','former-church-nave','no-ambient-music',
  'analogue-library','studio-desk-setup','cold-brew-on-tap','residents-only-bar',
  'scent-signature','dog-friendly','rooftop','local-roastery-coffee',
  'blackout-curtains','zero-checkout-anxiety',
]


// ============================================================
// components/onboard/steps/RateStep.tsx
// ============================================================

import { useState as useStateRate } from 'react'

export function RateStep({ state, update, next, prev, currentStep, totalSteps }: StepProps) {
  const rack  = parseInt(state.rackRate)  || 0
  const proto = parseInt(state.protocolRate) || (rack ? Math.round(rack * 0.85) : 0)
  const comm  = rack  ? Math.round(rack  * 0.25) : 0
  const save  = rack && proto ? rack - proto : 0
  const gain  = rack && proto ? proto - (rack - comm) : 0

  return (
    <>
      <StepEyebrow step={currentStep} total={totalSteps} />
      <h2 className="font-display text-3xl font-normal mb-2">Set your Protocol rate.</h2>
      <p className="text-[14px] font-light text-protocol-muted leading-relaxed mb-7 max-w-md">
        Your Protocol rate must be at least 15% below your Expedia price. Guests see the comparison — it has to be real.
      </p>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <Field label="Your Expedia / rack rate" hint="Per night, GBP">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-protocol-faint text-[14px]">£</span>
            <input
              className={`${inputCls} pl-7`}
              type="number"
              min="50" max="2000"
              value={state.rackRate}
              onChange={e => {
                const v = e.target.value
                update({ rackRate: v, protocolRate: v ? String(Math.round(parseInt(v) * 0.85)) : '' })
              }}
              placeholder="250"
            />
          </div>
        </Field>
        <Field label="Your Protocol direct rate" hint="Min 15% below rack">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-protocol-faint text-[14px]">£</span>
            <input
              className={`${inputCls} pl-7`}
              type="number"
              min="50" max="2000"
              value={state.protocolRate}
              onChange={e => update({ protocolRate: e.target.value })}
              placeholder={rack ? String(Math.round(rack * 0.85)) : '212'}
            />
          </div>
        </Field>
      </div>

      {/* Live rate comparison */}
      {rack > 0 && (
        <div className="bg-white border border-protocol-border rounded-sm overflow-hidden mb-2">
          <div className="px-4 py-2 border-b border-protocol-border">
            <p className="font-mono text-[9px] tracking-[0.1em] uppercase text-protocol-faint">
              Live comparison · per night
            </p>
          </div>
          {[
            { label: 'Expedia listing price',        val: rack   ? `£${rack}`                              : '—',  cls: '' },
            { label: 'Expedia commission (25%)',      val: comm   ? `-£${comm}`                             : '—',  cls: 'text-[#c0392b]' },
            { label: 'Hotel revenue via Expedia',     val: rack   ? `£${rack - comm}`                       : '—',  cls: 'text-protocol-faint' },
            { label: 'Protocol direct rate',          val: proto  ? `£${proto}`                             : '—',  cls: 'text-protocol-teal' },
            { label: 'Guest saving vs. Expedia',      val: save   ? `£${save} (${Math.round(save/rack*100)}%)` : '—', cls: 'text-protocol-teal' },
            { label: 'Hotel keeps more per booking',  val: gain   ? `+£${Math.max(0, gain)}`                : '—',  cls: 'text-protocol-teal' },
          ].map(r => (
            <div key={r.label} className="flex justify-between items-baseline px-4 py-2 border-b border-protocol-border last:border-0">
              <span className="text-[12px] text-protocol-muted">{r.label}</span>
              <span className={`font-mono text-[12px] font-medium ${r.cls || 'text-protocol-ink'}`}>{r.val}</span>
            </div>
          ))}
        </div>
      )}

      {rack > 0 && proto > 0 && (
        <p className="font-mono text-[9px] tracking-[0.08em] uppercase text-protocol-teal">
          Protocol rate = you keep more. Guest pays less. Nobody pays Expedia.
        </p>
      )}

      <NavRow
        onNext={next} onPrev={prev} hasBack
        nextLabel="Review application"
        step={currentStep} total={totalSteps}
      />
    </>
  )
}


// ============================================================
// components/onboard/steps/ReviewStep.tsx
// ============================================================

import { useTransition } from 'react'
import { submitOnboarding } from '@/app/actions/onboard'

const TIER_NAMES: Record<string, string> = {
  core: 'Protocol Core — £299 / month',
  plus: 'Protocol Plus — £599 / month',
  elite:'Protocol Elite — £999 / month',
}

export function ReviewStep({ state, prev, currentStep, totalSteps }: StepProps) {
  const [isPending, startTransition] = useTransition()

  const handleSubmit = () => {
    startTransition(async () => {
      await submitOnboarding(state)
    })
  }

  const sections = [
    {
      label: 'Membership',
      rows:  [
        { k: 'Tier',  v: TIER_NAMES[state.tier] ?? state.tier },
        { k: 'Rooms', v: state.tier === 'core' ? 'Up to 20 rooms' : state.tier === 'plus' ? 'Up to 80 rooms' : 'Unlimited' },
      ],
    },
    {
      label: 'Property',
      rows:  [
        { k: 'Name',    v: state.name     || '—' },
        { k: 'Borough', v: state.borough  || '—' },
        { k: 'Contact', v: state.contactEmail || '—' },
      ],
    },
    {
      label: 'Salvaged Stay',
      rows:  [
        { k: 'Former use', v: state.pastLife  || '—' },
        { k: 'Era',        v: state.era        || '—' },
        { k: 'Heritage',   v: state.heritage   || 'None' },
      ],
    },
    {
      label: 'Experience profile',
      rows:  [
        { k: 'Vibe',  v: state.vibe.replace(/_/g, ' ') },
        { k: 'Tags',  v: state.tags.length ? `${state.tags.length} selected` : '—' },
      ],
    },
    {
      label: 'Rates',
      rows:  [
        { k: 'Expedia / rack',   v: state.rackRate    ? `£${state.rackRate}`    : '—' },
        { k: 'Protocol direct',  v: state.protocolRate ? `£${state.protocolRate}` : '—' },
      ],
    },
  ]

  return (
    <>
      <StepEyebrow step={currentStep} total={totalSteps} />
      <h2 className="font-display text-3xl font-normal mb-2">Review and pay.</h2>
      <p className="text-[14px] font-light text-protocol-muted leading-relaxed mb-6 max-w-md">
        Check your details before we send you to Stripe. You can edit any section.
      </p>

      <div className="flex flex-col gap-3 mb-6">
        {sections.map(sec => (
          <div key={sec.label} className="bg-white border border-protocol-border rounded-sm overflow-hidden">
            <div className="px-4 py-2.5 border-b border-protocol-border flex items-center justify-between">
              <span className="font-mono text-[10px] tracking-[0.1em] uppercase text-protocol-faint">
                {sec.label}
              </span>
            </div>
            <div className="px-4 py-2">
              {sec.rows.map(r => (
                <div key={r.k} className="flex justify-between items-baseline py-1.5">
                  <span className="text-[12px] text-protocol-muted">{r.k}</span>
                  <span className="font-mono text-[11px] font-medium text-protocol-ink">{r.v}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Payment note */}
      <div className="flex items-start gap-3 bg-protocol-teal-light border border-[rgba(29,158,117,0.2)] rounded-sm px-4 py-3 mb-6">
        <svg className="w-4 h-4 flex-shrink-0 text-protocol-teal mt-0.5" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.2"/>
          <path d="M8 5v4M8 11v.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
        </svg>
        <p className="text-[12px] text-protocol-teal-dark leading-relaxed">
          Clicking "Continue to Stripe" creates your account and redirects to Stripe Checkout for your first month's subscription. Cancel anytime.
        </p>
      </div>

      <div className="flex items-center justify-between pt-5 border-t border-protocol-border">
        <button
          onClick={prev}
          className="font-mono text-[10px] tracking-[0.1em] uppercase px-4 py-2.5 border border-protocol-border-strong text-protocol-muted rounded-sm hover:bg-protocol-cream-dark transition-colors"
        >
          ← Back
        </button>
        <button
          onClick={handleSubmit}
          disabled={isPending}
          className={[
            'font-mono text-[10px] tracking-[0.1em] uppercase px-5 py-2.5 rounded-sm text-white transition-all',
            isPending ? 'bg-protocol-teal cursor-wait' : 'bg-protocol-teal hover:opacity-90 active:scale-[0.97]',
          ].join(' ')}
        >
          {isPending ? 'Creating account…' : 'Continue to Stripe →'}
        </button>
      </div>
    </>
  )
}


// ── Shared primitives ─────────────────────────────────────────

export function StepEyebrow({ step, total }: { step: number; total: number }) {
  return (
    <p className="font-mono text-[10px] tracking-[0.14em] uppercase text-protocol-teal mb-2">
      Step {step + 1} of {total}
    </p>
  )
}

export function Field({
  label, hint, children,
}: {
  label: string; hint?: string; children: React.ReactNode
}) {
  return (
    <div className="mb-4">
      <label className="block font-mono text-[10px] tracking-[0.08em] uppercase text-protocol-muted mb-1.5">
        {label}
        {hint && (
          <span className="normal-case text-protocol-faint text-[9px] ml-2 tracking-normal font-normal">
            ({hint})
          </span>
        )}
      </label>
      {children}
    </div>
  )
}

export function NavRow({
  onNext, onPrev, hasBack, nextLabel = 'Continue', step, total,
}: {
  onNext:     () => void
  onPrev?:    () => void
  hasBack:    boolean
  nextLabel?: string
  step:       number
  total:      number
}) {
  return (
    <div className="flex items-center justify-between mt-7 pt-5 border-t border-protocol-border">
      {hasBack && onPrev ? (
        <button
          onClick={onPrev}
          className="font-mono text-[10px] tracking-[0.1em] uppercase px-4 py-2.5 border border-protocol-border-strong text-protocol-muted rounded-sm hover:bg-protocol-cream-dark transition-colors"
        >
          ← Back
        </button>
      ) : <span />}
      <div className="flex items-center gap-4">
        <span className="font-mono text-[10px] text-protocol-faint tracking-wide">
          {step + 1} / {total}
        </span>
        <button
          onClick={onNext}
          className="font-mono text-[10px] tracking-[0.1em] uppercase px-5 py-2.5 bg-protocol-ink text-white rounded-sm hover:bg-[#2d2d2a] active:scale-[0.97] transition-all"
        >
          {nextLabel} →
        </button>
      </div>
    </div>
  )
}

export const inputCls = [
  'w-full bg-white border border-protocol-border rounded-sm px-3 py-2.5',
  'font-sans text-[14px] text-protocol-ink outline-none',
  'transition-[border-color] duration-150',
  'focus:border-protocol-ink',
  'placeholder:text-protocol-faint',
].join(' ')
