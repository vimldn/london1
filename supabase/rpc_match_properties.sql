-- ============================================================
-- THE LONDON PROTOCOL — pgvector RPC Function
-- Run in Supabase SQL Editor after deploying schema.sql
-- ============================================================

-- This is the PostgreSQL function called via supabase.rpc()
-- in the semantic-search Server Action.

create or replace function match_properties_semantic(
  query_embedding  vector(1536),
  match_threshold  float    default 0.30,
  match_count      int      default 24,
  filter_borough   text     default null,
  filter_past_life text     default null,
  filter_price_max numeric  default null
)
returns table (
  id                uuid,
  slug              text,
  name              text,
  tagline           text,
  borough           london_borough,
  protocol_nightly  numeric,
  ota_rate_cache    numeric,
  commission_tax_pct numeric,
  aeo_headline      text,
  schema_type       text,
  similarity        float
)
language sql stable
as $$
  select
    p.id,
    p.slug,
    p.name,
    p.tagline,
    p.borough,
    p.protocol_nightly,
    p.ota_rate_cache,
    p.commission_tax_pct,
    p.aeo_headline,
    p.schema_type,
    1 - (p.embedding <=> query_embedding) as similarity
  from properties p
  where
    p.is_active = true
    and p.embedding is not null
    -- Optional borough filter (cast text → enum safely)
    and (
      filter_borough is null
      or p.borough = filter_borough::london_borough
    )
    -- Optional past life filter via subquery
    and (
      filter_past_life is null
      or exists (
        select 1 from past_lives pl
        where pl.property_id = p.id
          and pl.former_use = filter_past_life::past_life_category
      )
    )
    -- Optional price cap
    and (
      filter_price_max is null
      or p.protocol_nightly <= filter_price_max
    )
    -- Cosine similarity threshold
    and 1 - (p.embedding <=> query_embedding) > match_threshold
  order by p.embedding <=> query_embedding   -- ascending distance = descending similarity
  limit match_count;
$$;
