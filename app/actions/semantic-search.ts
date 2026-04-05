// app/actions/semantic-search.ts
// ============================================================
// THE LONDON PROTOCOL — Semantic Search Server Action
// Next.js 15 App Router | Server Action | pgvector + OpenAI
// ============================================================

'use server'

import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'
import { z } from 'zod'

// ── Types ────────────────────────────────────────────────────

export interface ParsedIntent {
  borough:     string | null
  vibes:       string[]
  pastLife:    string | null
  tags:        string[]
  nights:      number | null
  priceMax:    number | null
  rawQuery:    string
  enrichedFor: string   // the enriched prompt we embed
}

export interface PropertyResult {
  id:                 string
  slug:               string
  name:               string
  tagline:            string | null
  borough:            string
  protocolNightly:    number
  otaRateCache:       number | null
  commissionSaved:    number | null
  commissionTaxPct:   number
  vibeScore:          number | null
  primaryVibe:        string | null
  pastLife:           string | null
  retainedFeatures:   string[]
  salvagedStayScore:  number | null
  matchedTags:        string[]
  similarity:         number
  aeoHeadline:        string | null
  schemaType:         string
}

export interface SearchResponse {
  results:      PropertyResult[]
  parsedIntent: ParsedIntent
  totalFound:   number
  queryId:      string
}

// ── Validation ───────────────────────────────────────────────

const SearchInputSchema = z.object({
  query:    z.string().min(3).max(500),
  checkIn:  z.string().optional(),
  checkOut: z.string().optional(),
  limit:    z.number().min(1).max(20).default(8),
})

// ── Clients ──────────────────────────────────────────────────

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!   // service role for server actions
  )
}

function getOpenAI() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })
}

// ── Intent Parser ────────────────────────────────────────────
// Uses Claude-mini/GPT-4o-mini to extract structured intent
// before embedding — dramatically improves recall precision.

async function parseIntent(query: string): Promise<ParsedIntent> {
  const openai = getOpenAI()

  const systemPrompt = `You are the London Protocol intent parser.
Extract structured travel intent from natural language queries about London hotels.

Return ONLY valid JSON matching this schema:
{
  "borough": string | null,           // London borough e.g. "shoreditch", "bermondsey"
  "vibes": string[],                  // from: quiet_luxury, high_energy, digital_nomad_optimized,
                                      //   romantic_retreat, creative_residency, corporate_zen,
                                      //   neighbourhood_immersion, hidden_locals_only
  "pastLife": string | null,          // from: bank, school, warehouse, factory, church,
                                      //   brewery, power_station, railway_arch, cinema etc.
  "tags": string[],                   // hyper-niche tags: reading-nook, circadian-lighting,
                                      //   vault-bedroom, warehouse-ceiling, ghost-sign-wall,
                                      //   no-ambient-music, studio-desk-setup, analogue-library etc.
  "nights": number | null,            // number of nights requested
  "priceMax": number | null,          // max nightly budget in GBP
  "enrichedFor": string               // rewrite the query as a rich hotel description for embedding
}`

  const response = await openai.chat.completions.create({
    model:       'gpt-4o-mini',
    temperature: 0,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: query }
    ],
    response_format: { type: 'json_object' },
  })

  const parsed = JSON.parse(response.choices[0].message.content ?? '{}')

  return {
    borough:     parsed.borough    ?? null,
    vibes:       parsed.vibes      ?? [],
    pastLife:    parsed.pastLife   ?? null,
    tags:        parsed.tags       ?? [],
    nights:      parsed.nights     ?? null,
    priceMax:    parsed.priceMax   ?? null,
    rawQuery:    query,
    enrichedFor: parsed.enrichedFor ?? query,
  }
}

// ── Embedding ────────────────────────────────────────────────

async function embedQuery(text: string): Promise<number[]> {
  const openai = getOpenAI()

  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  })

  return response.data[0].embedding
}

// ── Main Search Action ───────────────────────────────────────

export async function semanticSearch(
  input: z.infer<typeof SearchInputSchema>
): Promise<SearchResponse> {
  // 1. Validate input
  const { query, limit } = SearchInputSchema.parse(input)
  const supabase = getSupabase()

  // 2. Parse intent (structured extraction)
  const intent = await parseIntent(query)

  // 3. Embed the enriched query (not raw — crucial for precision)
  const queryEmbedding = await embedQuery(intent.enrichedFor)

  // 4. Vector similarity search via Supabase RPC
  //    (pgvector cosine distance, pre-filtered by borough/past_life if present)
  const { data: vectorResults, error } = await supabase.rpc(
    'match_properties_semantic',
    {
      query_embedding:  queryEmbedding,
      match_threshold:  0.30,
      match_count:      limit * 3,   // over-fetch then re-rank
      filter_borough:   intent.borough,
      filter_past_life: intent.pastLife,
      filter_price_max: intent.priceMax,
    }
  )

  if (error) {
    console.error('[LondonProtocol] Vector search error:', error)
    throw new Error(`Search failed: ${error.message}`)
  }

  // 5. Enrich results with vibe metrics, past lives, and rate data
  const propertyIds: string[] = (vectorResults ?? []).map((r: any) => r.id)

  if (propertyIds.length === 0) {
    return { results: [], parsedIntent: intent, totalFound: 0, queryId: '' }
  }

  // Parallel enrichment queries
  const [vibeData, pastLifeData, rateData, tagData] = await Promise.all([
    // Vibe metrics — get best matching vibe per property
    supabase
      .from('vibe_metrics')
      .select('property_id, vibe, score, circadian_lighting, reading_nook_present')
      .in('property_id', propertyIds)
      .order('score', { ascending: false }),

    // Past lives
    supabase
      .from('past_lives')
      .select('property_id, former_use, retained_features, salvaged_stay_score')
      .in('property_id', propertyIds),

    // Latest rate intelligence (materialised view)
    supabase
      .from('latest_rate_intelligence')
      .select('property_id, protocol_rate, expedia_rate, commission_saved')
      .in('property_id', propertyIds),

    // Tags — only the ones from the parsed intent (for match explanation)
    intent.tags.length > 0
      ? supabase
          .from('property_tags')
          .select('property_id, experience_tags(tag)')
          .in('property_id', propertyIds)
          .in('experience_tags.tag' as any, intent.tags)
      : Promise.resolve({ data: [] }),
  ])

  // 6. Re-rank: combine cosine similarity with intent-specific signals
  const enriched: PropertyResult[] = (vectorResults ?? [])
    .map((row: any) => {
      const vibes      = (vibeData.data   ?? []).filter(v => v.property_id === row.id)
      const pastLife   = (pastLifeData.data ?? []).find(p => p.property_id === row.id)
      const rate       = (rateData.data   ?? []).find(r => r.property_id === row.id)
      const tags       = (tagData.data    ?? [])
                          .filter((t: any) => t.property_id === row.id)
                          .map((t: any) => t.experience_tags?.tag)
                          .filter(Boolean)

      const topVibe    = vibes[0] ?? null

      // Boost score for intent matches
      let boostScore   = row.similarity as number

      if (intent.pastLife && pastLife?.former_use === intent.pastLife)
        boostScore += 0.12
      if (intent.vibes.includes(topVibe?.vibe))
        boostScore += 0.08
      if (intent.tags.some(t => tags.includes(t)))
        boostScore += tags.filter(t => intent.tags.includes(t)).length * 0.04
      if (intent.tags.includes('circadian-lighting') && topVibe?.circadian_lighting)
        boostScore += 0.05
      if (intent.tags.includes('reading-nook') && topVibe?.reading_nook_present)
        boostScore += 0.05

      return {
        id:                 row.id,
        slug:               row.slug,
        name:               row.name,
        tagline:            row.tagline,
        borough:            row.borough,
        protocolNightly:    rate?.protocol_rate  ?? row.protocol_nightly,
        otaRateCache:       rate?.expedia_rate   ?? row.ota_rate_cache,
        commissionSaved:    rate?.commission_saved ?? null,
        commissionTaxPct:   row.commission_tax_pct,
        vibeScore:          topVibe?.score       ?? null,
        primaryVibe:        topVibe?.vibe        ?? null,
        pastLife:           pastLife?.former_use ?? null,
        retainedFeatures:   pastLife?.retained_features ?? [],
        salvagedStayScore:  pastLife?.salvaged_stay_score ?? null,
        matchedTags:        tags,
        similarity:         boostScore,
        aeoHeadline:        row.aeo_headline,
        schemaType:         row.schema_type,
      } satisfies PropertyResult
    })
    .sort((a: PropertyResult, b: PropertyResult) => b.similarity - a.similarity)
    .slice(0, limit)

  // 7. Log search query for ranking feedback loop
  const { data: logRow } = await supabase
    .from('search_queries')
    .insert({
      raw_query:     query,
      parsed_intent: intent,
      result_ids:    enriched.map(r => r.id),
    })
    .select('id')
    .single()

  return {
    results:      enriched,
    parsedIntent: intent,
    totalFound:   vectorResults?.length ?? 0,
    queryId:      logRow?.id ?? '',
  }
}

// ── Click Tracking (for ranking feedback) ────────────────────

export async function trackPropertyClick(
  queryId:    string,
  propertyId: string
): Promise<void> {
  if (!queryId || !propertyId) return
  const supabase = getSupabase()
  await supabase
    .from('search_queries')
    .update({ clicked_id: propertyId })
    .eq('id', queryId)
}
