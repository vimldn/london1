// app/dashboard/rates/page.tsx
// ============================================================
// THE LONDON PROTOCOL — Rate Management Page
// Next.js 16 Server Component + Client Rate Editor
// ============================================================

import { createServerClient }  from '@supabase/ssr'
import { cookies }             from 'next/headers'
import { redirect }            from 'next/navigation'
import { RateEditor }          from '@/components/dashboard/RateEditor'

async function getRateData(propertyId: string) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )

  const [propertyRes, snapshotsRes] = await Promise.all([
    supabase
      .from('properties')
      .select('id, name, protocol_nightly, rack_rate, ota_rate_cache, commission_tax_pct')
      .eq('id', propertyId)
      .single(),

    // Last 30 days of rate snapshots for the history chart
    supabase
      .from('rate_snapshots')
      .select('protocol_rate, expedia_rate, scraped_at')
      .eq('property_id', propertyId)
      .order('scraped_at', { ascending: false })
      .limit(30),
  ])

  return {
    property:  propertyRes.data,
    snapshots: snapshotsRes.data ?? [],
  }
}

export default async function RatesPage() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: account } = await supabase
    .from('hotel_accounts')
    .select('property_id')
    .eq('contact_email', user.email!)
    .single()

  if (!account) redirect('/login')

  const { property, snapshots } = await getRateData(account.property_id)

  return (
    <div className="space-y-4">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-normal">Rate management</h1>
        <p className="text-sm text-protocol-muted font-light mt-0.5">
          Set your Protocol direct rate. Guests see the live comparison with Expedia.
        </p>
      </div>

      <RateEditor
        propertyId={account.property_id}
        initialRackRate={property?.rack_rate ?? property?.ota_rate_cache ?? 0}
        initialProtocolRate={property?.protocol_nightly ?? 0}
        commissionPct={property?.commission_tax_pct ?? 25}
        snapshots={snapshots.map(s => ({
          date:         s.scraped_at.split('T')[0],
          protocolRate: s.protocol_rate,
          expediaRate:  s.expedia_rate,
        }))}
      />
    </div>
  )
}


// ============================================================
// components/dashboard/RateEditor.tsx — Client Component
// ============================================================

'use client'

import { useState, useTransition } from 'react'
import { updatePropertyRates }     from '@/app/actions/dashboard'

interface RateEditorProps {
  propertyId:          string
  initialRackRate:     number
  initialProtocolRate: number
  commissionPct:       number
  snapshots:           { date: string; protocolRate: number; expediaRate: number | null }[]
}

export function RateEditor({
  propertyId, initialRackRate, initialProtocolRate, commissionPct, snapshots,
}: RateEditorProps) {
  const [rack,  setRack]  = useState(initialRackRate)
  const [proto, setProto] = useState(initialProtocolRate)
  const [saved, setSaved] = useState(false)
  const [isPending, startTransition] = useTransition()

  const comm      = rack  ? Math.round(rack  * commissionPct / 100) : 0
  const save      = rack && proto ? Math.round(rack - proto) : 0
  const savePct   = rack  ? Math.round(save / rack * 100) : 0
  const hotelRev  = rack  ? rack - comm : 0
  const gain      = proto ? proto - hotelRev : 0
  const qualifies = rack && proto ? ((rack - proto) / rack) >= 0.15 : false

  const handleSave = () => {
    startTransition(async () => {
      await updatePropertyRates({ propertyId, rackRate: rack, protocolRate: proto })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    })
  }

  const maxSnapshot = Math.max(...snapshots.map(s => s.expediaRate ?? s.protocolRate), rack, 1)

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        {/* Rate inputs */}
        <div className="bg-white border border-protocol-border rounded-protocol overflow-hidden">
          <div className="px-4 py-2.5 border-b border-protocol-border">
            <span className="font-mono text-[10px] tracking-[0.1em] uppercase text-protocol-faint">
              Update rates
            </span>
          </div>
          <div className="px-4 py-4 space-y-4">
            <RateField
              label="Expedia / rack rate"
              hint="Per night, GBP"
              value={rack}
              onChange={v => {
                setRack(v)
                setProto(Math.round(v * 0.85))
              }}
            />
            <RateField
              label="Protocol direct rate"
              hint="Min 15% below rack"
              value={proto}
              onChange={setProto}
            />

            {/* Qualification indicator */}
            <div className={`flex items-center gap-2 px-3 py-2 rounded-protocol ${qualifies ? 'bg-protocol-teal-light' : 'bg-red-50'}`}>
              <svg
                className={`w-3.5 h-3.5 shrink-0 ${qualifies ? 'text-protocol-teal' : 'text-red-500'}`}
                viewBox="0 0 14 14" fill="none"
              >
                {qualifies
                  ? <path d="M2.5 7l3 3 6-6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                  : <path d="M7 4v4M7 10v.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                }
              </svg>
              <span className={`font-mono text-[9px] tracking-[0.08em] uppercase ${qualifies ? 'text-protocol-teal-dark' : 'text-red-600'}`}>
                {qualifies
                  ? `Qualifies — ${Math.round((rack - proto) / rack * 100)}% below Expedia`
                  : `Must be ≥ 15% below Expedia (currently ${Math.round((rack - proto) / rack * 100)}%)`
                }
              </span>
            </div>

            <button
              onClick={handleSave}
              disabled={isPending || !qualifies}
              className={[
                'w-full font-mono text-[10px] tracking-[0.1em] uppercase py-2.5 rounded-protocol',
                'transition-all duration-150 disabled:opacity-40',
                saved
                  ? 'bg-protocol-teal text-white'
                  : isPending
                  ? 'bg-protocol-teal text-white cursor-wait'
                  : 'bg-protocol-ink text-white hover:bg-[#2d2d2a] active:scale-[0.97]',
              ].join(' ')}
            >
              {saved ? 'Saved ✓' : isPending ? 'Saving…' : 'Save rates'}
            </button>
          </div>
        </div>

        {/* Live breakdown */}
        <div className="bg-white border border-protocol-border rounded-protocol overflow-hidden">
          <div className="px-4 py-2.5 border-b border-protocol-border">
            <span className="font-mono text-[10px] tracking-[0.1em] uppercase text-protocol-faint">
              Live commission breakdown
            </span>
          </div>
          <div className="px-4 py-2">
            {[
              { label: 'Expedia listing price',       val: rack   ? `£${rack}`                                 : '—',  cls: 'line-through text-protocol-faint' },
              { label: `Expedia commission (${commissionPct}%)`, val: comm ? `-£${comm}`                       : '—',  cls: 'text-[#c0392b]'  },
              { label: 'Hotel revenue via Expedia',   val: rack   ? `£${hotelRev}`                             : '—',  cls: 'text-protocol-faint' },
              { label: 'Protocol direct rate',        val: proto  ? `£${proto}`                                : '—',  cls: 'text-protocol-teal' },
              { label: 'Guest saving vs. Expedia',    val: save && rack ? `£${save} (${savePct}%)`             : '—',  cls: 'text-protocol-teal' },
              { label: 'You keep more per booking',   val: gain > 0 ? `+£${gain}`                              : '£0', cls: gain > 0 ? 'text-protocol-teal' : 'text-protocol-faint' },
            ].map(r => (
              <div key={r.label} className="flex justify-between items-baseline py-2 border-b border-protocol-border last:border-0">
                <span className="text-[12px] text-protocol-muted">{r.label}</span>
                <span className={`font-mono text-[12px] font-medium ${r.cls}`}>{r.val}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Rate history chart */}
      {snapshots.length > 0 && (
        <div className="bg-white border border-protocol-border rounded-protocol overflow-hidden">
          <div className="px-4 py-2.5 border-b border-protocol-border">
            <span className="font-mono text-[10px] tracking-[0.1em] uppercase text-protocol-faint">
              Rate history · last 30 snapshots
            </span>
          </div>
          <div className="px-4 pt-3 pb-4">
            <div className="flex items-end gap-1.5 h-16">
              {snapshots.slice(0, 20).reverse().map((s, i) => {
                const h = Math.round((s.protocolRate / maxSnapshot) * 56)
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <div
                      className="w-full bg-protocol-teal-light rounded-sm"
                      style={{ height: `${h}px` }}
                    />
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function RateField({
  label, hint, value, onChange,
}: {
  label:    string
  hint:     string
  value:    number
  onChange: (v: number) => void
}) {
  return (
    <div>
      <label className="block font-mono text-[9px] tracking-[0.1em] uppercase text-protocol-faint mb-1.5">
        {label}
        <span className="normal-case text-[9px] ml-1.5 tracking-normal font-normal">({hint})</span>
      </label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-protocol-faint text-[14px]">£</span>
        <input
          type="number"
          value={value || ''}
          onChange={e => onChange(parseInt(e.target.value) || 0)}
          className={[
            'w-full bg-protocol-cream border border-protocol-border-strong rounded-protocol',
            'pl-7 pr-3 py-2 font-mono text-[14px] font-medium text-protocol-ink text-right',
            'outline-none focus:border-protocol-ink focus:bg-white transition-all',
          ].join(' ')}
          placeholder="0"
        />
      </div>
    </div>
  )
}


// ============================================================
// app/actions/dashboard.ts — Rate update server action
// ============================================================

'use server'

import { createClient }     from '@supabase/supabase-js'
import { revalidatePath }   from 'next/cache'
import { z }                from 'zod'

const UpdateRatesSchema = z.object({
  propertyId:   z.string().uuid(),
  rackRate:     z.number().min(50).max(5000),
  protocolRate: z.number().min(50).max(5000),
})

export async function updatePropertyRates(input: z.infer<typeof UpdateRatesSchema>) {
  const { propertyId, rackRate, protocolRate } = UpdateRatesSchema.parse(input)

  // Enforce min 15% discount
  const discount = (rackRate - protocolRate) / rackRate
  if (discount < 0.14) {
    throw new Error('Protocol rate must be at least 15% below the rack rate.')
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  await supabase
    .from('properties')
    .update({
      rack_rate:        rackRate,
      protocol_nightly: protocolRate,
      updated_at:       new Date().toISOString(),
    })
    .eq('id', propertyId)

  // Log the change as a rate snapshot
  await supabase.from('rate_snapshots').insert({
    property_id:   propertyId,
    protocol_rate: protocolRate,
    expedia_rate:  rackRate,
    check_in:      new Date().toISOString().split('T')[0],
    check_out:     new Date().toISOString().split('T')[0],
    scrape_method: 'manual',
  })

  // Refresh cached data on the dashboard
  revalidatePath('/dashboard')
  revalidatePath('/dashboard/rates')
}
