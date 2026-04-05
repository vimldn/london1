// app/onboard/page.tsx
// ============================================================
// THE LONDON PROTOCOL — Hotel Onboarding Entry Page
// Server Component — renders the wizard shell
// ============================================================

import type { Metadata } from 'next'
import { OnboardingWizard } from '@/components/onboard/OnboardingWizard'

export const metadata: Metadata = {
  title:       'Apply to List Your Property | The London Protocol',
  description: 'Join the Protocol. A flat monthly subscription replaces 25% OTA commission. No Expedia. No Booking.com. Your rate, your margin.',
  robots:      { index: true, follow: true },
  openGraph: {
    title:       'Join The London Protocol',
    description: 'Reclaim your margin. Flat subscription. Zero commission.',
    type:        'website',
  },
}

export default function OnboardPage() {
  return (
    <main className="min-h-screen bg-protocol-cream">
      <OnboardingWizard />
    </main>
  )
}


// ============================================================
// app/onboard/success/page.tsx
// Post-Stripe-redirect confirmation page
// ============================================================

import type { Metadata } from 'next'
import { createClient }  from '@supabase/supabase-js'
import { redirect }      from 'next/navigation'

export const metadata: Metadata = {
  title: 'Welcome to the Protocol | The London Protocol',
  robots: { index: false, follow: false },
}

interface Props {
  searchParams: { session_id?: string; ref?: string }
}

export default async function OnboardSuccessPage({ searchParams }: Props) {
  const { session_id, ref } = searchParams

  if (!session_id && !ref) redirect('/onboard')

  // Verify Stripe session and pull application ref
  let applicationRef = ref ?? ''
  let hotelName      = ''

  if (session_id) {
    try {
      const stripe = (await import('stripe')).default
      const client = new stripe(process.env.STRIPE_SECRET_KEY!)
      const session = await client.checkout.sessions.retrieve(session_id)
      applicationRef = (session.metadata?.applicationRef as string) ?? ref ?? ''
      hotelName      = (session.metadata?.propertyName   as string) ?? ''

      // Mark application as payment_confirmed in Supabase
      if (applicationRef) {
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        )
        await supabase
          .from('onboarding_applications')
          .update({ status: 'payment_confirmed', stripe_session: session_id })
          .eq('application_ref', applicationRef)
      }
    } catch (e) {
      console.error('[OnboardSuccess] Stripe verify failed:', e)
    }
  }

  const nextSteps = [
    { n: '01', text: 'Your subscription is confirmed. Stripe receipt sent to your email.' },
    { n: '02', text: 'Our team reviews your Salvaged Stay profile. We may request photos or additional detail.' },
    { n: '03', text: 'Your property goes live in the Protocol directory — indexed by the NL concierge.' },
    { n: '04', text: 'We generate your specialty JSON-LD and submit to Google Search Console for SGE indexing.' },
  ]

  return (
    <main className="min-h-screen bg-protocol-cream flex flex-col">
      {/* Header */}
      <header className="bg-protocol-ink px-7 py-3.5 flex items-center gap-3">
        <span className="font-mono text-[11px] tracking-[0.18em] uppercase text-white/90">
          The London Protocol
        </span>
        <span className="w-1 h-1 rounded-full bg-protocol-teal" />
        <span className="font-mono text-[10px] tracking-[0.1em] uppercase text-white/35">
          Hotel Application
        </span>
      </header>

      <div className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-md">
          {/* Success icon */}
          <div className="w-14 h-14 rounded-full bg-protocol-teal-light border border-[rgba(29,158,117,0.2)] flex items-center justify-center mx-auto mb-6">
            <svg className="w-6 h-6 text-protocol-teal" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M8 12l3 3 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>

          <h1 className="font-display text-3xl font-normal text-center mb-2">
            Application received.
          </h1>
          <p className="text-[14px] font-light text-protocol-muted text-center leading-relaxed mb-6">
            {hotelName
              ? `${hotelName} is now in review.`
              : 'Your property is now in review.'}{' '}
            We'll have you live within the week.
          </p>

          {applicationRef && (
            <div className="font-mono text-[11px] tracking-[0.1em] bg-protocol-cream-dark text-protocol-muted px-4 py-2.5 rounded-sm text-center mb-6">
              {applicationRef}
            </div>
          )}

          {/* Next steps */}
          <div className="bg-white border border-protocol-border rounded-sm overflow-hidden">
            <div className="px-4 py-2.5 border-b border-protocol-border">
              <p className="font-mono text-[9px] tracking-[0.1em] uppercase text-protocol-faint">
                What happens next
              </p>
            </div>
            <div className="px-4 py-1">
              {nextSteps.map((s, i) => (
                <div
                  key={i}
                  className="flex gap-3 py-3 border-b border-protocol-border last:border-0"
                >
                  <span className="font-mono text-[10px] text-protocol-teal flex-shrink-0 w-5">
                    {s.n}
                  </span>
                  <p className="text-[12px] text-protocol-muted leading-relaxed">{s.text}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 text-center">
            <a
              href="/"
              className="font-mono text-[10px] tracking-[0.1em] uppercase text-protocol-faint hover:text-protocol-ink transition-colors"
            >
              ← Back to the Protocol
            </a>
          </div>
        </div>
      </div>
    </main>
  )
}
