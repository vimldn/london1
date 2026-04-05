// lib/schema/property-jsonld.ts
// ============================================================
// THE LONDON PROTOCOL — Specialty JSON-LD Generator
// Targets: Google SGE, 'Salvaged Stay', 'Readaway' keywords
// ============================================================

import type { PropertyResult } from '@/app/actions/semantic-search'

interface PropertySchemaInput {
  property:   PropertyResult
  checkIn?:   string
  checkOut?:  string
  baseUrl?:   string
}

// ── Primary LodgingBusiness Schema ───────────────────────────
// Augmented with historicBuilding, amenityFeature, and
// custom 'SalvagedStay' + 'Readaway' offer types for SGE.

export function generatePropertySchema(input: PropertySchemaInput): object {
  const { property, checkIn, checkOut, baseUrl = 'https://londonprotocol.com' } = input

  const url = `${baseUrl}/stay/${property.slug}`

  // Base schema
  const schema: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': ['LodgingBusiness', 'Hotel'],
    '@id': url,
    name:        property.name,
    description: property.aeoHeadline ?? property.tagline,
    url,
    address: {
      '@type':         'PostalAddress',
      addressLocality: formatBorough(property.borough),
      addressRegion:   'London',
      addressCountry:  'GB',
    },
    priceRange: `£${property.protocolNightly} per night`,
    offers: buildOffers(property, checkIn, checkOut, url),
  }

  // ── Salvaged Stay augmentation ────────────────────────────
  // Only added when property has a past life — this is what
  // SGE picks up for 'converted hotel London' queries.
  if (property.pastLife) {
    schema['additionalProperty'] = schema['additionalProperty'] ?? []
    schema['additionalProperty'].push(
      {
        '@type':   'PropertyValue',
        name:      'SalvagedStay',
        value:     formatPastLife(property.pastLife),
        valueReference: {
          '@type': 'DefinedTerm',
          name:    'Former Use Category',
          termCode: property.pastLife,
        },
      },
      {
        '@type': 'PropertyValue',
        name:    'RetainedFeatures',
        value:   property.retainedFeatures.join(', '),
      }
    )

    // Historic building marker — high SGE recall signal
    schema['containsPlace'] = {
      '@type': 'LandmarksOrHistoricalBuildings',
      name:    `Former ${formatPastLife(property.pastLife)}`,
      description: `This property was originally a ${formatPastLife(property.pastLife).toLowerCase()}, converted and reimagined as a London boutique hotel with original architectural features retained.`,
    }
  }

  // ── Readaway augmentation ─────────────────────────────────
  // Targets 'hotel with reading room London', 'quiet hotel
  // London', 'literary hotel London' SGE snippets.
  if (property.matchedTags?.includes('reading-nook') || property.matchedTags?.includes('analogue-library')) {
    schema['amenityFeature'] = schema['amenityFeature'] ?? []
    schema['amenityFeature'].push(
      {
        '@type':       'LocationFeatureSpecification',
        name:          'Readaway Lounge',
        value:         true,
        valueReference: {
          '@type': 'DefinedTerm',
          name:    'Readaway',
          description: 'A curated, quiet reading environment within the property — physical library, reading nook, or silent lounge — designed for guests who prioritise analog focus over entertainment.',
        },
      }
    )
  }

  // ── Vibe amenity features ─────────────────────────────────
  if (property.primaryVibe) {
    schema['amenityFeature'] = schema['amenityFeature'] ?? []
    schema['amenityFeature'].push({
      '@type': 'LocationFeatureSpecification',
      name:    formatVibe(property.primaryVibe),
      value:   true,
    })
  }

  // ── Circadian lighting signal ─────────────────────────────
  if (property.matchedTags?.includes('circadian-lighting')) {
    schema['amenityFeature'] = schema['amenityFeature'] ?? []
    schema['amenityFeature'].push({
      '@type':       'LocationFeatureSpecification',
      name:          'Circadian Lighting System',
      value:         true,
      valueReference: {
        '@type':       'DefinedTerm',
        name:          'Circadian Lighting',
        description:   'Lighting that shifts colour temperature through the day — warm amber at dusk, cool white at dawn — to support the body\'s natural sleep-wake cycle.',
      },
    })
  }

  // ── Review aggregate placeholder ─────────────────────────
  schema['aggregateRating'] = {
    '@type':       'AggregateRating',
    ratingValue:   '4.8',
    reviewCount:   '12',
    bestRating:    '5',
    worstRating:   '1',
  }

  return schema
}

// ── Neighbourhood Swap (The Loop) Itinerary Schema ───────────

export function generateSwapSchema(swap: {
  name:          string
  slug:          string
  description:   string
  contrastThesis:string
  propertyA:     { name: string; borough: string; slug: string; nights: number }
  propertyB:     { name: string; borough: string; slug: string; nights: number }
  loopRate:      number
  baseUrl?:      string
}): object {
  const { baseUrl = 'https://londonprotocol.com' } = swap

  return {
    '@context': 'https://schema.org',
    '@type':    'TouristTrip',
    '@id':      `${baseUrl}/loop/${swap.slug}`,
    name:       swap.name,
    description: swap.description,
    abstract:   swap.contrastThesis,
    offers: {
      '@type':         'Offer',
      name:            'Protocol Loop Rate',
      price:           swap.loopRate,
      priceCurrency:   'GBP',
      availability:    'https://schema.org/InStock',
      url:             `${baseUrl}/loop/${swap.slug}`,
    },
    itinerary: {
      '@type': 'ItemList',
      itemListElement: [
        {
          '@type':    'ListItem',
          position:    1,
          name:       `Nights 1–${swap.propertyA.nights}: ${swap.propertyA.name}`,
          item: {
            '@type':         'LodgingBusiness',
            name:             swap.propertyA.name,
            url:             `${baseUrl}/stay/${swap.propertyA.slug}`,
            address: {
              '@type':         'PostalAddress',
              addressLocality:  formatBorough(swap.propertyA.borough),
              addressRegion:    'London',
              addressCountry:   'GB',
            },
          },
        },
        {
          '@type':    'ListItem',
          position:    2,
          name:       `Nights ${swap.propertyA.nights + 1}–${swap.propertyA.nights + swap.propertyB.nights}: ${swap.propertyB.name}`,
          item: {
            '@type':         'LodgingBusiness',
            name:             swap.propertyB.name,
            url:             `${baseUrl}/stay/${swap.propertyB.slug}`,
            address: {
              '@type':         'PostalAddress',
              addressLocality:  formatBorough(swap.propertyB.borough),
              addressRegion:    'London',
              addressCountry:   'GB',
            },
          },
        },
      ],
    },
    keywords: ['London neighbourhood swap', 'London hotel itinerary', 'Salvaged Stay London', swap.name],
  }
}

// ── Offer builder (handles Protocol vs OTA pricing) ──────────

function buildOffers(
  property: PropertyResult,
  checkIn:  string | undefined,
  checkOut: string | undefined,
  url:      string
): object[] {
  const offers: object[] = [
    {
      '@type':          'Offer',
      name:             'Protocol-Direct Rate',
      description:      'Zero-commission direct booking rate — no OTA markup.',
      price:             property.protocolNightly,
      priceCurrency:    'GBP',
      availability:     'https://schema.org/InStock',
      url,
      validFrom:        checkIn,
      priceValidUntil:  checkOut,
      seller: {
        '@type': 'Organization',
        name:    'The London Protocol',
        url:     'https://londonprotocol.com',
      },
    },
  ]

  // Add OTA comparison offer for rich result potential
  if (property.otaRateCache) {
    offers.push({
      '@type':         'Offer',
      name:            'OTA Rate (for comparison)',
      description:     `Third-party OTA rate including ~${property.commissionTaxPct}% commission passed to consumer.`,
      price:            property.otaRateCache,
      priceCurrency:   'GBP',
      availability:    'https://schema.org/InStock',
      seller: {
        '@type': 'Organization',
        name:    'Online Travel Agency',
      },
    })
  }

  return offers
}

// ── Formatters ───────────────────────────────────────────────

function formatBorough(borough: string): string {
  return borough
    .split('_')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

function formatPastLife(pastLife: string): string {
  const map: Record<string, string> = {
    bank:                 'Bank',
    school:               'School',
    warehouse:            'Warehouse',
    factory:              'Factory',
    church:               'Church',
    courthouse:           'Courthouse',
    hospital:             'Hospital',
    fire_station:         'Fire Station',
    library:              'Library',
    market_hall:          'Market Hall',
    brewery:              'Brewery',
    power_station:        'Power Station',
    printworks:           'Printworks',
    railway_arch:         'Railway Arch',
    victorian_mansion:    'Victorian Mansion',
    edwardian_terrace:    'Edwardian Terrace',
    post_office:          'Post Office',
    telephone_exchange:   'Telephone Exchange',
    cinema:               'Cinema',
  }
  return map[pastLife] ?? pastLife
}

function formatVibe(vibe: string): string {
  const map: Record<string, string> = {
    quiet_luxury:               'Quiet Luxury',
    high_energy:                'High Energy',
    digital_nomad_optimized:    'Digital Nomad Optimized',
    romantic_retreat:           'Romantic Retreat',
    creative_residency:         'Creative Residency',
    corporate_zen:              'Corporate Zen',
    neighbourhood_immersion:    'Neighbourhood Immersion',
    hidden_locals_only:         'Hidden — Locals Only',
  }
  return map[vibe] ?? vibe
}

// ── Next.js page helper: inject schema into <head> ───────────
// Usage in page.tsx:
//   const schema = generatePropertySchema({ property, checkIn, checkOut })
//   return (
//     <>
//       <script type="application/ld+json"
//               dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
//       ...
//     </>
//   )
