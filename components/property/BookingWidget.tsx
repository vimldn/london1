'use client'

// components/property/BookingWidget.tsx
// ============================================================
// THE LONDON PROTOCOL — Booking Widget
// Client component — live total calc, date state, CTA
// ============================================================

import { useState, useTransition } from 'react'
import { useRouter }               from 'next/navigation'

interface BookingWidgetProps {
  propertyId:      string
  propertySlug:    string
  protocolRate:    number
  otaRate:         number | null
  commissionPct:   number
  defaultCheckIn:  string
  defaultCheckOut: string
  defaultGuests:   number
}

export function BookingWidget({
  propertyId,
  propertySlug,
  protocolRate,
  otaRate,
  commissionPct,
  defaultCheckIn,
  defaultCheckOut,
  defaultGuests,
}: BookingWidgetProps) {
  const router = useRouter()
  const [checkIn,  setCheckIn]  = useState(defaultCheckIn)
  const [checkOut, setCheckOut] = useState(defaultCheckOut)
  const [guests,   setGuests]   = useState(defaultGuests)
  const [isPending, startTransition] = useTransition()

  const nights    = nightsBetween(checkIn, checkOut)
  const subtotal  = protocolRate * nights
  const otaTotal  = otaRate ? Math.round(otaRate * nights) : null
  const save      = otaTotal ? otaTotal - subtotal : null
  const savePct   = otaTotal && save ? Math.round(save / otaTotal * 100) : null

  const handleBook = () => {
    startTransition(() => {
      router.push(
        `/stay/${propertySlug}/book?checkIn=${checkIn}&checkOut=${checkOut}&guests=${guests}`
      )
    })
  }

  return (
    <div className="bg-white border border-protocol-border-strong rounded-protocol overflow-hidden shadow-none">
      {/* Header */}
      <div className="bg-protocol-ink px-4 py-3.5">
        <p className="font-mono text-[9px] tracking-[0.1em] uppercase text-white/40 mb-1">
          Protocol direct rate
        </p>
        <p className="font-display text-[28px] text-white font-normal leading-none">
          £{protocolRate}
        </p>
        <p className="font-mono text-[9px] tracking-[0.06em] uppercase text-white/30 mt-1">
          per night · zero commission
        </p>
      </div>

      {/* Inputs */}
      <div className="px-4 py-4 space-y-3">
        {/* Dates */}
        <div className="grid grid-cols-2 gap-2">
          <DateField
            label="Check-in"
            value={checkIn}
            min={today()}
            onChange={v => {
              setCheckIn(v)
              if (v >= checkOut) setCheckOut(addDays(v, 1))
            }}
          />
          <DateField
            label="Check-out"
            value={checkOut}
            min={addDays(checkIn, 1)}
            onChange={setCheckOut}
          />
        </div>

        {/* Guests */}
        <div>
          <label className="block font-mono text-[9px] tracking-[0.08em] uppercase text-protocol-faint mb-1.5">
            Guests
          </label>
          <select
            value={guests}
            onChange={e => setGuests(parseInt(e.target.value))}
            className="w-full border border-protocol-border-strong rounded-protocol px-3 py-2 font-sans text-[13px] text-protocol-ink bg-protocol-cream outline-none focus:border-protocol-ink transition-colors appearance-none"
          >
            {[1, 2, 3, 4].map(n => (
              <option key={n} value={n}>{n} {n === 1 ? 'guest' : 'guests'}</option>
            ))}
          </select>
        </div>

        {/* Total breakdown */}
        <div className="bg-protocol-cream rounded-protocol px-3 py-2.5 space-y-1.5">
          <div className="flex justify-between items-baseline">
            <span className="text-[12px] text-protocol-muted">
              £{protocolRate} × {nights} {nights === 1 ? 'night' : 'nights'}
            </span>
            <span className="font-mono text-[12px] font-medium">£{subtotal}</span>
          </div>
          {otaTotal && (
            <div className="flex justify-between items-baseline">
              <span className="text-[12px] text-protocol-muted">Expedia price</span>
              <span className="font-mono text-[11px] text-protocol-faint line-through">£{otaTotal}</span>
            </div>
          )}
          {save && save > 0 && (
            <p className="font-mono text-[9px] tracking-[0.06em] uppercase text-protocol-teal pt-1 border-t border-protocol-border">
              You save £{save} ({savePct}%) — no commission
            </p>
          )}
        </div>

        {/* CTA */}
        <button
          onClick={handleBook}
          disabled={isPending || nights < 1}
          className={[
            'w-full font-mono text-[10px] tracking-[0.12em] uppercase py-3 rounded-protocol',
            'transition-all duration-150 disabled:opacity-40',
            isPending
              ? 'bg-protocol-teal text-white cursor-wait'
              : 'bg-protocol-ink text-white hover:bg-[#2d2d2a] active:scale-[0.97]',
          ].join(' ')}
        >
          {isPending ? 'Loading…' : 'Reserve · Protocol Direct'}
        </button>

        {/* Verified stamp */}
        <div className="flex items-center gap-2 px-3 py-2 bg-protocol-teal-light border border-[rgba(29,158,117,0.15)] rounded-protocol">
          <svg className="w-3 h-3 shrink-0 text-protocol-teal" viewBox="0 0 12 12" fill="none">
            <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.2"/>
            <path d="M3.5 6l2 2L9 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span className="font-mono text-[9px] tracking-[0.06em] text-protocol-teal-dark">
            Rates verified · no OTA markup
          </span>
        </div>
      </div>
    </div>
  )
}

function DateField({
  label, value, min, onChange,
}: {
  label:    string
  value:    string
  min?:     string
  onChange: (v: string) => void
}) {
  return (
    <div>
      <label className="block font-mono text-[9px] tracking-[0.08em] uppercase text-protocol-faint mb-1.5">
        {label}
      </label>
      <input
        type="date"
        value={value}
        min={min}
        onChange={e => onChange(e.target.value)}
        className="w-full border border-protocol-border-strong rounded-protocol px-2.5 py-2 font-mono text-[11px] text-protocol-ink bg-protocol-cream outline-none focus:border-protocol-ink transition-colors"
      />
    </div>
  )
}

function nightsBetween(a: string, b: string): number {
  return Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000))
}
function today() {
  return new Date().toISOString().split('T')[0]
}
function addDays(date: string, n: number) {
  const d = new Date(date); d.setDate(d.getDate() + n); return d.toISOString().split('T')[0]
}


// ============================================================
// app/login/page.tsx — Hotel Partner Login
// Next.js 16 Server Component
// ============================================================

// (Move to its own file: app/login/page.tsx)

import type { Metadata as LoginMeta } from 'next'
export const loginMetadata: LoginMeta = {
  title:   'Hotel Partner Login | The London Protocol',
  robots:  { index: false, follow: false },
}

// The login page is a server component that renders
// the LoginForm client component. On successful auth,
// Supabase sets cookies and Next.js redirects to /dashboard.

// app/login/page.tsx:
//
// import { LoginForm } from '@/components/auth/LoginForm'
// export { loginMetadata as metadata }
// export default function LoginPage() {
//   return <LoginForm />
// }


// ============================================================
// components/auth/LoginForm.tsx — Client Component
// ============================================================

'use client'

import { useState, useTransition } from 'react'
import { signInWithMagicLink, signInWithPassword } from '@/app/actions/auth'

type AuthMode = 'magic' | 'password'

export function LoginForm() {
  const [mode,       setMode]       = useState<AuthMode>('magic')
  const [email,      setEmail]      = useState('')
  const [password,   setPassword]   = useState('')
  const [magicSent,  setMagicSent]  = useState(false)
  const [error,      setError]      = useState<string | null>(null)
  const [isPending,  startTransition] = useTransition()

  const handleMagic = () => {
    if (!email) return
    setError(null)
    startTransition(async () => {
      const result = await signInWithMagicLink(email)
      if (result.error) setError(result.error)
      else              setMagicSent(true)
    })
  }

  const handlePassword = () => {
    if (!email || !password) return
    setError(null)
    startTransition(async () => {
      const result = await signInWithPassword(email, password)
      if (result?.error) setError(result.error)
      // On success the server action calls redirect('/dashboard')
    })
  }

  return (
    <div className="min-h-screen grid grid-cols-2">
      {/* Left panel */}
      <div className="bg-protocol-ink flex flex-col justify-between px-10 py-12">
        <div>
          <p className="font-mono text-[9px] tracking-[0.16em] uppercase text-white/35 mb-5">
            Hotel Partner Portal
          </p>
          <h1 className="font-display text-[2rem] font-normal text-white leading-tight mb-4">
            Your margin.<br />
            <em className="italic text-white/50">Restored.</em>
          </h1>
          <p className="text-[14px] text-white/35 font-light leading-relaxed max-w-xs mb-8">
            The Protocol dashboard gives you full visibility into bookings, rate performance, and commission recovered — in real time.
          </p>
          <div className="space-y-3">
            {[
              { val: '£38',  label: 'avg saved per guest per night' },
              { val: '25%',  label: 'commission recovered per booking' },
              { val: '47',   label: 'properties live in London' },
            ].map(s => (
              <div key={s.label} className="flex items-baseline gap-3">
                <span className="font-display text-2xl text-white/80">{s.val}</span>
                <span className="font-mono text-[9px] tracking-[0.1em] uppercase text-white/30">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
        <p className="font-mono text-[9px] tracking-[0.08em] uppercase text-white/20">
          londonprotocol.com · hello@londonprotocol.com
        </p>
      </div>

      {/* Right panel */}
      <div className="bg-protocol-cream flex flex-col items-center justify-center px-10 py-12">
        <div className="w-full max-w-[320px]">
          <p className="font-mono text-[10px] tracking-[0.14em] uppercase text-protocol-teal mb-2">
            Hotel partner access
          </p>
          <h2 className="font-display text-2xl font-normal mb-1">Sign in.</h2>
          <p className="text-[13px] text-protocol-muted font-light mb-6">
            Access your property dashboard and rate tools.
          </p>

          {/* Mode tabs */}
          <div className="flex border-b border-protocol-border mb-5">
            {(['magic', 'password'] as AuthMode[]).map(m => (
              <button
                key={m}
                onClick={() => { setMode(m); setError(null); setMagicSent(false) }}
                className={[
                  'font-mono text-[10px] tracking-[0.08em] uppercase px-4 py-1.5',
                  'border-b-2 -mb-px transition-all',
                  mode === m
                    ? 'border-b-protocol-ink text-protocol-ink'
                    : 'border-b-transparent text-protocol-faint hover:text-protocol-muted',
                ].join(' ')}
              >
                {m === 'magic' ? 'Magic link' : 'Password'}
              </button>
            ))}
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-protocol px-3 py-2 mb-4">
              <p className="font-mono text-[10px] text-red-600 tracking-wide">{error}</p>
            </div>
          )}

          {/* Email (both modes) */}
          <AuthField
            label="Email address"
            type="email"
            value={email}
            onChange={setEmail}
            placeholder="you@yourproperty.com"
            disabled={magicSent}
          />

          {/* Password mode */}
          {mode === 'password' && (
            <>
              <AuthField
                label="Password"
                type="password"
                value={password}
                onChange={setPassword}
                placeholder="••••••••"
              />
              <div className="text-right mb-3 -mt-2">
                <a
                  href="/login/reset"
                  className="font-mono text-[9px] tracking-wide text-protocol-faint hover:text-protocol-muted transition-colors"
                >
                  Forgot password?
                </a>
              </div>
            </>
          )}

          {/* Magic link sent state */}
          {magicSent ? (
            <div className="bg-protocol-teal-light border border-[rgba(29,158,117,0.2)] rounded-protocol px-4 py-3 mb-4 text-center">
              <p className="font-mono text-[10px] tracking-[0.06em] text-protocol-teal-dark leading-relaxed">
                Link sent to {email}<br />
                Check your inbox — expires in 10 minutes.
              </p>
            </div>
          ) : (
            <button
              onClick={mode === 'magic' ? handleMagic : handlePassword}
              disabled={isPending || !email || (mode === 'password' && !password)}
              className={[
                'w-full font-mono text-[10px] tracking-[0.12em] uppercase py-2.5 rounded-protocol mb-3',
                'transition-all duration-150 disabled:opacity-40',
                isPending
                  ? 'bg-protocol-teal text-white cursor-wait'
                  : 'bg-protocol-ink text-white hover:bg-[#2d2d2a] active:scale-[0.97]',
              ].join(' ')}
            >
              {isPending
                ? mode === 'magic' ? 'Sending…' : 'Signing in…'
                : mode === 'magic' ? 'Send magic link →' : 'Sign in →'
              }
            </button>
          )}

          <p className="text-center font-mono text-[9px] tracking-[0.06em] text-protocol-faint mt-5">
            Not a Protocol partner yet?{' '}
            <a href="/onboard" className="text-protocol-teal hover:opacity-70 transition-opacity">
              Apply to list →
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}

function AuthField({
  label, type, value, onChange, placeholder, disabled,
}: {
  label:       string
  type:        string
  value:       string
  onChange:    (v: string) => void
  placeholder: string
  disabled?:   boolean
}) {
  return (
    <div className="mb-4">
      <label className="block font-mono text-[9px] tracking-[0.1em] uppercase text-protocol-muted mb-1.5">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className={[
          'w-full border border-protocol-border-strong rounded-protocol px-3 py-2.5',
          'font-sans text-[14px] text-protocol-ink bg-white outline-none',
          'transition-[border-color] focus:border-protocol-ink',
          'placeholder:text-protocol-faint disabled:opacity-50 disabled:bg-protocol-cream',
        ].join(' ')}
      />
    </div>
  )
}


// ============================================================
// app/actions/auth.ts — Supabase auth server actions
// ============================================================

'use server'

import { createServerClient }  from '@supabase/ssr'
import { cookies }             from 'next/headers'
import { redirect }            from 'next/navigation'

type AuthResult = { error: string | null }

export async function signInWithMagicLink(email: string): Promise<AuthResult> {
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

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_BASE_URL}/auth/callback`,
      shouldCreateUser: false,   // Only existing hotel partners can sign in
    },
  })

  if (error) {
    // Don't leak whether the email exists
    if (error.message.includes('not found') || error.message.includes('Invalid')) {
      return { error: 'No Protocol partner account found for this email address.' }
    }
    return { error: 'Failed to send magic link. Please try again.' }
  }

  return { error: null }
}

export async function signInWithPassword(
  email:    string,
  password: string
): Promise<AuthResult | never> {
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

  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return { error: 'Invalid email or password.' }
  }

  redirect('/dashboard')
}

export async function signOut(): Promise<never> {
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
  await supabase.auth.signOut()
  redirect('/login')
}


// ============================================================
// app/auth/callback/route.ts — Supabase auth callback handler
// Handles magic link redirects from Supabase email
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient as createCB } from '@supabase/ssr'
import { cookies as cbCookies }           from 'next/headers'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code  = searchParams.get('code')
  const next  = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const cookieStore = await cbCookies()
    const supabase = createCB(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll:    () => cookieStore.getAll(),
          setAll:    (cs) => cs.forEach(c => cookieStore.set(c)),
        },
      }
    )

    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(new URL(next, request.url))
    }
  }

  return NextResponse.redirect(new URL('/login?error=auth', request.url))
}
