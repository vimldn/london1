'use client'

// components/onboard/OnboardingWizard.tsx
// ============================================================
// THE LONDON PROTOCOL — Hotel Onboarding Wizard
// Client component — manages step state, renders sidebar + steps
// ============================================================

import { useState, useCallback }    from 'react'
import { TierStep }                  from './steps/TierStep'
import { PropertyStep }              from './steps/PropertyStep'
import { PastLifeStep }              from './steps/PastLifeStep'
import { VibeStep }                  from './steps/VibeStep'
import { RateStep }                  from './steps/RateStep'
import { ReviewStep }                from './steps/ReviewStep'
import type { OnboardingState }      from '@/types/onboard'

// ── Steps config ─────────────────────────────────────────────

const STEPS = [
  { label: 'Membership tier',    sub: 'Choose your plan'      },
  { label: 'Your property',      sub: 'Name & location'       },
  { label: 'Past life',          sub: 'Salvaged Stay details' },
  { label: 'Experience profile', sub: 'Vibe & tags'           },
  { label: 'Rate setting',       sub: 'Protocol pricing'      },
  { label: 'Review & pay',       sub: 'Confirm + Stripe'      },
]

const INITIAL_STATE: OnboardingState = {
  tier:         'plus',
  name:         '',
  tagline:      '',
  borough:      '',
  postcode:     '',
  contactName:  '',
  contactEmail: '',
  contactPhone: '',
  pastLife:     '',
  era:          '',
  heritage:     '',
  retainedFeatures: '',
  salvageStory: '',
  vibe:         'quiet_luxury',
  tags:         [],
  rackRate:     '',
  protocolRate: '',
}

// ── Wizard shell ──────────────────────────────────────────────

export function OnboardingWizard() {
  const [step, setStep]   = useState(0)
  const [state, setState] = useState<OnboardingState>(INITIAL_STATE)

  const update = useCallback(
    (patch: Partial<OnboardingState>) =>
      setState(s => ({ ...s, ...patch })),
    []
  )

  const next = useCallback(() => setStep(s => Math.min(s + 1, STEPS.length - 1)), [])
  const prev = useCallback(() => setStep(s => Math.max(s - 1, 0)), [])
  const goTo = useCallback((i: number) => { if (i <= step) setStep(i) }, [step])

  const stepProps = { state, update, next, prev, currentStep: step, totalSteps: STEPS.length }

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0 bg-protocol-ink flex flex-col px-5 py-8">
        <p className="font-display text-sm italic text-white/50 leading-snug mb-7">
          Join the Protocol.<br />Reclaim your margin.
        </p>

        {/* Step list */}
        <ol className="flex flex-col gap-0 flex-1">
          {STEPS.map((s, i) => {
            const status = i < step ? 'done' : i === step ? 'active' : 'idle'
            return (
              <li key={i} className="relative">
                {/* Connector line */}
                {i < STEPS.length - 1 && (
                  <span className="absolute left-[10px] top-[26px] w-px h-[calc(100%-6px)] bg-white/[0.07]" />
                )}
                <button
                  onClick={() => goTo(i)}
                  disabled={i > step}
                  className="flex items-start gap-2.5 py-2.5 w-full text-left group"
                >
                  {/* Number / check */}
                  <span className={[
                    'w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center mt-0.5',
                    'font-mono text-[9px] transition-all duration-200',
                    status === 'done'   ? 'bg-protocol-teal'        : '',
                    status === 'active' ? 'bg-white'                : '',
                    status === 'idle'   ? 'border border-white/15'  : '',
                  ].join(' ')}>
                    {status === 'done' ? (
                      <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
                        <path d="M1.5 4.5L3.5 6.5L7.5 2.5" stroke="white" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    ) : (
                      <span className={status === 'active' ? 'text-protocol-ink' : 'text-white/25'}>
                        {i + 1}
                      </span>
                    )}
                  </span>

                  <span>
                    <span className={[
                      'block font-mono text-[10px] tracking-[0.06em] uppercase leading-tight',
                      status === 'active' ? 'text-white'       : '',
                      status === 'done'   ? 'text-white/50'    : '',
                      status === 'idle'   ? 'text-white/25'    : '',
                    ].join(' ')}>
                      {s.label}
                    </span>
                    <span className="block text-[10px] text-white/20 mt-0.5">{s.sub}</span>
                  </span>
                </button>
              </li>
            )
          })}
        </ol>

        <div className="pt-5 border-t border-white/[0.07] mt-4">
          <p className="text-[11px] text-white/25 leading-relaxed">
            Questions?{' '}
            <a href="mailto:hello@londonprotocol.com" className="text-white/40 hover:text-white/60 transition-colors">
              hello@londonprotocol.com
            </a>
          </p>
          <p className="text-[11px] text-white/20 mt-1">
            We review every application personally.
          </p>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 px-10 py-10 overflow-y-auto">
        <div
          key={step}
          className="max-w-[560px] animate-[stepFadeIn_0.22s_ease_forwards]"
          style={{ animation: 'stepFadeIn 0.22s ease forwards' }}
        >
          {step === 0 && <TierStep    {...stepProps} />}
          {step === 1 && <PropertyStep{...stepProps} />}
          {step === 2 && <PastLifeStep{...stepProps} />}
          {step === 3 && <VibeStep    {...stepProps} />}
          {step === 4 && <RateStep    {...stepProps} />}
          {step === 5 && <ReviewStep  {...stepProps} />}
        </div>
      </main>

      <style>{`
        @keyframes stepFadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0);    }
        }
      `}</style>
    </div>
  )
}
