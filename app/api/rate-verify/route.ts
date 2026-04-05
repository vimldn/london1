// app/api/rate-verify/route.ts
// ============================================================
// THE LONDON PROTOCOL — OTA Rate Intelligence Scraper
// Next.js 15 App Router | Route Handler
//
// Strategy (in priority order):
//   1. Return cached Supabase snapshot if < 4h old
//   2. Booking.com Demand API (if partner access)
//   3. Playwright headless scrape (Expedia + Booking + Hotels.com)
//   4. Mark as stale — return last known with staleness flag
//
// Deploy note: Playwright requires a Node.js runtime with
// Chrome installed. On Vercel, use a Fluid compute function
// with the @vercel/playwright layer, or route to a dedicated
// scraper microservice (Railway/Fly.io).
// ============================================================

import { NextRequest, NextResponse }  from 'next/server'
import { createClient }               from '@supabase/supabase-js'
import { z }                          from 'zod'

const QuerySchema = z.object({
  propertyId: z.string().uuid(),
  checkIn:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  checkOut:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  adults:     z.coerce.number().int().min(1).max(4).default(2),
})

export interface RateVerifyResponse {
  propertyId:     string
  checkIn:        string
  checkOut:       string
  protocolRate:   number
  expediaRate:    number | null
  bookingRate:    number | null
  hotelsRate:     number | null
  commissionAmt:  number | null
  commissionPct:  number
  youSave:        number | null
  youSavePct:     number | null
  hotelRevenue:   number | null       // what hotel gets if booked via OTA
  scrapedAt:      string
  isCached:       boolean
  cacheAge:       number | null       // minutes since last scrape
  breakdown:      CommissionBreakdown
}

export interface CommissionBreakdown {
  expediaLabel:    string
  commissionLabel: string
  saveLabel:       string
  receiptLines:    ReceiptLine[]
}

export interface ReceiptLine {
  description: string
  subtext:     string
  amount:      string
  type:        'cross' | 'red' | 'muted' | 'teal'
}

// ── GET handler ──────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const parsed = QuerySchema.safeParse({
    propertyId: searchParams.get('propertyId'),
    checkIn:    searchParams.get('checkIn'),
    checkOut:   searchParams.get('checkOut'),
    adults:     searchParams.get('adults'),
  })

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid params', issues: parsed.error.issues },
      { status: 400 }
    )
  }

  const { propertyId, checkIn, checkOut, adults } = parsed.data
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // 1. Fetch property's current protocol rate + OTA identifiers
  const { data: property, error: propErr } = await supabase
    .from('properties')
    .select(`
      id, name, slug, protocol_nightly, commission_tax_pct,
      ota_rate_cache, ota_rate_cached_at
    `)
    .eq('id', propertyId)
    .single()

  if (propErr || !property) {
    return NextResponse.json({ error: 'Property not found' }, { status: 404 })
  }

  // 2. Check cache freshness (4-hour window)
  const CACHE_TTL_MINS = 240
  const cachedAt       = property.ota_rate_cached_at
    ? new Date(property.ota_rate_cached_at)
    : null
  const cacheAgeMins   = cachedAt
    ? Math.floor((Date.now() - cachedAt.getTime()) / 60000)
    : null
  const isCached       = cacheAgeMins !== null && cacheAgeMins < CACHE_TTL_MINS

  if (isCached && property.ota_rate_cache) {
    return NextResponse.json(
      buildResponse({
        property,
        expediaRate:  property.ota_rate_cache,
        bookingRate:  null,
        hotelsRate:   null,
        checkIn,
        checkOut,
        scrapedAt:    property.ota_rate_cached_at!,
        isCached:     true,
        cacheAgeMins: cacheAgeMins!,
      }),
      {
        headers: {
          'Cache-Control': 'public, max-age=900, stale-while-revalidate=3600',
        },
      }
    )
  }

  // 3. Live scrape (Playwright)
  let scraped: ScrapedRates | null = null
  try {
    scraped = await scrapeOTARates({ propertyId, checkIn, checkOut, adults })
  } catch (err) {
    console.error('[RateVerify] Scrape failed:', err)
    // Fall through to stale cache or null
  }

  // 4. If scrape failed, return stale data with flag
  if (!scraped && property.ota_rate_cache) {
    return NextResponse.json(
      buildResponse({
        property,
        expediaRate:  property.ota_rate_cache,
        bookingRate:  null,
        hotelsRate:   null,
        checkIn,
        checkOut,
        scrapedAt:    property.ota_rate_cached_at ?? new Date().toISOString(),
        isCached:     true,
        cacheAgeMins: cacheAgeMins ?? 9999,
      }),
      { status: 200 }
    )
  }

  if (!scraped) {
    return NextResponse.json({ error: 'Rate data unavailable' }, { status: 503 })
  }

  // 5. Write fresh snapshot to Supabase
  const now = new Date().toISOString()

  const commissionTax = buildCommissionTaxPayload(
    property.protocol_nightly,
    scraped.expediaRate ?? property.ota_rate_cache,
    property.commission_tax_pct
  )

  await Promise.all([
    supabase.from('rate_snapshots').insert({
      property_id:          propertyId,
      check_in:             checkIn,
      check_out:            checkOut,
      protocol_rate:        property.protocol_nightly,
      expedia_rate:         scraped.expediaRate,
      booking_rate:         scraped.bookingRate,
      hotels_com_rate:      scraped.hotelsRate,
      commission_saved:     commissionTax?.youSave ?? null,
      commission_tax_visual: commissionTax,
      scraped_at:           now,
      scrape_method:        'playwright',
    }),
    // Update the cached value on the property itself
    supabase.from('properties').update({
      ota_rate_cache:     scraped.expediaRate ?? scraped.bookingRate,
      ota_rate_cached_at: now,
    }).eq('id', propertyId),
    // Refresh materialised view
    supabase.rpc('refresh_rate_intelligence'),
  ])

  return NextResponse.json(
    buildResponse({
      property,
      expediaRate:  scraped.expediaRate,
      bookingRate:  scraped.bookingRate,
      hotelsRate:   scraped.hotelsRate,
      checkIn,
      checkOut,
      scrapedAt:    now,
      isCached:     false,
      cacheAgeMins: 0,
    }),
    {
      headers: {
        'Cache-Control': 'public, max-age=900, stale-while-revalidate=3600',
      },
    }
  )
}

// ── Playwright scraper ───────────────────────────────────────

interface ScrapedRates {
  expediaRate:  number | null
  bookingRate:  number | null
  hotelsRate:   number | null
}

async function scrapeOTARates(params: {
  propertyId: string
  checkIn:    string
  checkOut:   string
  adults:     number
}): Promise<ScrapedRates> {
  // Dynamic import — keeps the edge runtime happy if this
  // route is accidentally deployed there
  const { chromium } = await import('playwright')

  const browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
    ],
  })

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    locale: 'en-GB',
    timezoneId: 'Europe/London',
    viewport: { width: 1280, height: 800 },
    extraHTTPHeaders: { 'Accept-Language': 'en-GB,en;q=0.9' },
  })

  // Grab property's OTA slug/ID from DB
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const { data: ota } = await supabase
    .from('ota_identifiers')   // see schema note below
    .select('expedia_id, booking_id, hotels_id')
    .eq('property_id', params.propertyId)
    .single()

  const results: ScrapedRates = {
    expediaRate: null,
    bookingRate: null,
    hotelsRate:  null,
  }

  const ci = params.checkIn.replace(/-/g, '')
  const co = params.checkOut.replace(/-/g, '')

  // ── Expedia ───────────────────────────────────────────────
  if (ota?.expedia_id) {
    try {
      const page = await context.newPage()
      const url  = `https://www.expedia.co.uk/h${ota.expedia_id}.Hotel-Information?chkin=${params.checkIn}&chkout=${params.checkOut}&x_pwa=1&rm1=a${params.adults}`
      await page.goto(url, { waitUntil: 'networkidle', timeout: 20000 })

      // Wait for price element
      await page.waitForSelector('[data-stid="price-summary-title-priceDetails"]', { timeout: 8000 })
        .catch(() => null)

      const priceText = await page
        .$eval('[data-stid="price-summary-title-priceDetails"]', el => el.textContent)
        .catch(() => null)

      if (priceText) {
        const match = priceText.match(/£([\d,]+)/)
        if (match) results.expediaRate = parseInt(match[1].replace(',', ''), 10)
      }

      await page.close()
    } catch (e) {
      console.warn('[Scraper] Expedia failed:', e)
    }
  }

  // ── Booking.com ───────────────────────────────────────────
  if (ota?.booking_id) {
    try {
      const page = await context.newPage()
      const url  = `https://www.booking.com/hotel/gb/${ota.booking_id}.en-gb.html?checkin=${params.checkIn}&checkout=${params.checkOut}&group_adults=${params.adults}&no_rooms=1`
      await page.goto(url, { waitUntil: 'networkidle', timeout: 20000 })

      await page.waitForSelector('[data-testid="price-and-discounted-price"]', { timeout: 8000 })
        .catch(() => null)

      const priceText = await page
        .$eval('[data-testid="price-and-discounted-price"]', el => el.textContent)
        .catch(() => null)

      if (priceText) {
        const match = priceText.match(/£([\d,]+)/)
        if (match) results.bookingRate = parseInt(match[1].replace(',', ''), 10)
      }

      await page.close()
    } catch (e) {
      console.warn('[Scraper] Booking.com failed:', e)
    }
  }

  await browser.close()
  return results
}

// ── Response builder ─────────────────────────────────────────

function buildResponse(params: {
  property:     any
  expediaRate:  number | null
  bookingRate:  number | null
  hotelsRate:   number | null
  checkIn:      string
  checkOut:     string
  scrapedAt:    string
  isCached:     boolean
  cacheAgeMins: number
}): RateVerifyResponse {
  const { property, expediaRate, bookingRate, hotelsRate } = params
  const p   = property.protocol_nightly
  const pct = property.commission_tax_pct ?? 25

  const primary = expediaRate ?? bookingRate ?? hotelsRate
  const comm    = primary ? Math.round(primary * pct / 100) : null
  const save    = primary ? Math.round(primary - p) : null
  const savePct = primary && save ? Math.round(save / primary * 100) : null
  const hotelRev = primary && comm ? primary - comm : null

  const breakdown = buildCommissionBreakdown(p, primary, pct, comm, save, hotelRev)

  return {
    propertyId:    property.id,
    checkIn:       params.checkIn,
    checkOut:      params.checkOut,
    protocolRate:  p,
    expediaRate,
    bookingRate,
    hotelsRate,
    commissionAmt: comm,
    commissionPct: pct,
    youSave:       save,
    youSavePct:    savePct,
    hotelRevenue:  hotelRev,
    scrapedAt:     params.scrapedAt,
    isCached:      params.isCached,
    cacheAge:      params.cacheAgeMins,
    breakdown,
  }
}

function buildCommissionBreakdown(
  protocolRate: number,
  otaRate:      number | null,
  commPct:      number,
  commAmt:      number | null,
  save:         number | null,
  hotelRev:     number | null
): CommissionBreakdown {
  if (!otaRate || !commAmt || !save || !hotelRev) {
    return { expediaLabel: '', commissionLabel: '', saveLabel: '', receiptLines: [] }
  }

  return {
    expediaLabel:    `£${otaRate} on Expedia tonight`,
    commissionLabel: `£${commAmt} (${commPct}%) goes to Expedia — not the hotel`,
    saveLabel:       `£${save} saved booking Protocol direct`,
    receiptLines: [
      {
        description: 'Expedia listing price',
        subtext:     'What you\'d pay on their platform',
        amount:      `£${otaRate}`,
        type:        'cross',
      },
      {
        description: `Expedia commission (${commPct}%)`,
        subtext:     'Hidden in the price — goes to Expedia, not the hotel',
        amount:      `-£${commAmt}`,
        type:        'red',
      },
      {
        description: 'Hotel\'s actual revenue per room',
        subtext:     'What the property actually receives',
        amount:      `£${hotelRev}`,
        type:        'muted',
      },
      {
        description: 'Protocol direct rate',
        subtext:     'You pay this — hotel keeps every penny',
        amount:      `£${protocolRate}`,
        type:        'teal',
      },
    ],
  }
}

function buildCommissionTaxPayload(
  protocolRate: number,
  otaRate:      number | null,
  commPct:      number
) {
  if (!otaRate) return null
  const comm  = Math.round(otaRate * commPct / 100)
  const save  = Math.round(otaRate - protocolRate)
  return {
    protocol_rate:     protocolRate,
    ota_rate:          otaRate,
    commission_amount: comm,
    commission_pct:    commPct,
    you_save:          save,
    saving_pct:        Math.round(save / otaRate * 100),
  }
}

// ── Schema note ──────────────────────────────────────────────
// Add to schema.sql:
//
// create table ota_identifiers (
//   property_id  uuid primary key references properties(id) on delete cascade,
//   expedia_id   text,    -- numeric hotel ID e.g. "8916498"
//   booking_id   text,    -- slug e.g. "the-bermondsey-loom"
//   hotels_id    text,
//   updated_at   timestamptz default now()
// );
