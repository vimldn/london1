-- ============================================================
-- THE LONDON PROTOCOL — Database Schema v1.0
-- Supabase / PostgreSQL + pgvector
-- ============================================================

-- EXTENSIONS
-- ============================================================
create extension if not exists "uuid-ossp";
create extension if not exists vector;          -- pgvector for semantic search
create extension if not exists pg_trgm;         -- trigram fuzzy matching for tags

-- ============================================================
-- ENUM TYPES
-- ============================================================

create type london_borough as enum (
  'city_of_london','westminster','camden','islington','hackney',
  'tower_hamlets','southwark','lambeth','wandsworth','hammersmith',
  'kensington','chelsea','fulham','shoreditch','bermondsey',
  'bethnal_green','dalston','peckham','brixton','clerkenwell',
  'spitalfields','wapping','rotherhithe','greenwich','deptford'
);

create type past_life_category as enum (
  'bank','school','warehouse','factory','church','courthouse',
  'hospital','fire_station','library','market_hall','brewery',
  'power_station','printworks','railway_arch','victorian_mansion',
  'edwardian_terrace','post_office','telephone_exchange','cinema'
);

create type vibe_tier as enum (
  'quiet_luxury','high_energy','digital_nomad_optimized',
  'romantic_retreat','creative_residency','corporate_zen',
  'neighbourhood_immersion','hidden_locals_only'
);

create type subscription_tier as enum (
  'protocol_core',       -- £299/mo  — up to 20 rooms
  'protocol_plus',       -- £599/mo  — up to 80 rooms
  'protocol_elite'       -- £999/mo  — unlimited, priority ranking
);

-- ============================================================
-- CORE: PROPERTIES
-- ============================================================

create table properties (
  id                  uuid primary key default uuid_generate_v4(),
  slug                text unique not null,
  name                text not null,
  tagline             text,                          -- "The bank vault that learned to dream"
  description         text,
  borough             london_borough not null,
  postcode            text not null,
  latitude            numeric(9,6),
  longitude           numeric(9,6),

  -- Direct rate intelligence
  protocol_nightly    numeric(10,2) not null,        -- our direct rate
  rack_rate           numeric(10,2),                 -- hotel's own website rate
  ota_rate_cache      numeric(10,2),                 -- last scraped Expedia/Booking rate
  ota_rate_cached_at  timestamptz,
  commission_tax_pct  numeric(4,1) default 25.0,     -- the 'commission tax' we show users

  -- SEO / AEO fields
  schema_type         text default 'LodgingBusiness',
  meta_description    text,
  aeo_headline        text,                          -- for Google SGE snippet targeting
  readaway_keywords   text[],                        -- 'Salvaged Stay', 'Readaway' etc.

  -- Semantic embedding (1536-dim for text-embedding-3-small)
  embedding           vector(1536),

  -- Flags
  is_active           boolean default true,
  is_verified         boolean default false,
  featured            boolean default false,

  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

-- Semantic similarity index (HNSW for sub-10ms recall)
create index idx_properties_embedding
  on properties using hnsw (embedding vector_cosine_ops)
  with (m = 16, ef_construction = 64);

create index idx_properties_borough on properties(borough);
create index idx_properties_slug    on properties(slug);

-- ============================================================
-- PAST LIVES — Salvaged Stay Attributes
-- ============================================================

create table past_lives (
  id                    uuid primary key default uuid_generate_v4(),
  property_id           uuid not null references properties(id) on delete cascade,

  former_use            past_life_category not null,
  era                   text,                        -- "Victorian", "1930s Art Deco", "Brutalist 1970s"
  original_name         text,                        -- "The Midland Grand", "Bankside Power Station"
  year_built            smallint,
  year_converted        smallint,

  -- Preserved architectural salvage details
  retained_features     text[],   -- ["original vault door","Victorian terrazzo","exposed riveted steel"]
  salvage_story         text,     -- long-form prose for SGE / AEO rich results
  heritage_listing      text,     -- "Grade II*", "Grade I", null

  -- AEO targeting
  salvaged_stay_score   smallint check (salvaged_stay_score between 1 and 10),
  schema_historical_tag text,     -- feeds into JSON-LD 'historicBuilding' property

  created_at            timestamptz default now()
);

create index idx_past_lives_property   on past_lives(property_id);
create index idx_past_lives_former_use on past_lives(former_use);

-- ============================================================
-- VIBE METRICS — Experience Entity Scoring
-- ============================================================

create table vibe_metrics (
  id                        uuid primary key default uuid_generate_v4(),
  property_id               uuid not null references properties(id) on delete cascade,
  vibe                      vibe_tier not null,

  -- Scored 0-100
  score                     smallint not null check (score between 0 and 100),

  -- Sub-dimension scores (drive the NL concierge ranking)
  noise_floor_db            smallint,               -- measured ambient noise level
  natural_light_score       smallint check (natural_light_score between 0 and 100),
  circadian_lighting        boolean default false,
  reading_nook_present      boolean default false,
  reading_nook_description  text,
  wifi_speed_mbps           smallint,
  desk_quality_score        smallint check (desk_quality_score between 0 and 100),

  -- Social energy proxies
  has_communal_workspace    boolean default false,
  has_rooftop               boolean default false,
  has_cocktail_bar          boolean default false,
  bar_energy                text,                   -- "speakeasy", "rooftop-scene", "hotel-lobby-quiet"

  -- Sensory profile
  scent_profile             text,                   -- "beeswax and aged leather", "concrete and cedar"
  texture_palette           text[],                 -- ["raw linen","brushed brass","reclaimed oak"]
  colour_palette            text[],                 -- ["slate","ochre","bone"]

  verified_by_inspector     boolean default false,
  inspector_notes           text,

  created_at                timestamptz default now(),
  unique(property_id, vibe)
);

create index idx_vibe_metrics_property on vibe_metrics(property_id);
create index idx_vibe_metrics_vibe     on vibe_metrics(vibe);

-- ============================================================
-- EXPERIENCE TAGS — Hyper-Niche AEO Tags
-- ============================================================

create table experience_tags (
  id          uuid primary key default uuid_generate_v4(),
  tag         text unique not null,           -- "circadian-lighting", "reading-nook", "vault-bedroom"
  category    text not null,                  -- "spatial","sensory","social","work","salvage"
  aeo_weight  numeric(3,2) default 1.0,       -- multiplier for search ranking
  description text,
  created_at  timestamptz default now()
);

-- Many-to-many: properties ↔ tags
create table property_tags (
  property_id uuid references properties(id) on delete cascade,
  tag_id      uuid references experience_tags(id) on delete cascade,
  confidence  numeric(3,2) default 1.0,       -- 0-1, how strongly property exhibits this tag
  primary key (property_id, tag_id)
);

create index idx_property_tags_property on property_tags(property_id);
create index idx_property_tags_tag      on property_tags(tag_id);

-- ============================================================
-- THE LOOP — Neighbourhood Swap Itinerary Logic
-- ============================================================

create table neighbourhood_swaps (
  id              uuid primary key default uuid_generate_v4(),
  slug            text unique not null,
  name            text not null,              -- "The Shoreditch-Peckham Diagonal"
  description     text,

  -- The two paired properties
  property_a_id   uuid not null references properties(id),
  property_b_id   uuid not null references properties(id),

  -- Why this pairing works
  contrast_thesis text,    -- "Start in the warehouse, end in the railway arch"
  shared_thread   text,    -- "Both former industrial, separated by 5 miles and 40 years of gentrification"

  -- Swap logic
  nights_a        smallint default 2,
  nights_b        smallint default 2,
  recommended_split text,  -- "Wed-Thu Peckham / Fri-Sat Shoreditch"

  -- Pricing
  loop_rate       numeric(10,2),              -- bundled Protocol rate
  loop_saving_pct numeric(4,1),              -- vs. booking separately

  -- AEO / Schema
  itinerary_schema jsonb,                    -- pre-built JSON-LD for the itinerary
  aeo_keywords    text[],

  is_active       boolean default true,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),

  constraint no_self_swap check (property_a_id <> property_b_id)
);

create index idx_swaps_property_a on neighbourhood_swaps(property_a_id);
create index idx_swaps_property_b on neighbourhood_swaps(property_b_id);

-- ============================================================
-- RATE INTELLIGENCE — OTA Price Surveillance Log
-- ============================================================

create table rate_snapshots (
  id              uuid primary key default uuid_generate_v4(),
  property_id     uuid not null references properties(id) on delete cascade,
  check_in        date not null,
  check_out       date not null,

  -- Rate data
  protocol_rate   numeric(10,2) not null,
  expedia_rate    numeric(10,2),
  booking_rate    numeric(10,2),
  hotels_com_rate numeric(10,2),
  direct_rate     numeric(10,2),             -- hotel's own website

  -- Derived
  commission_saved      numeric(10,2),       -- expedia_rate - protocol_rate (user saving)
  commission_tax_visual jsonb,               -- pre-computed breakdown for UI component

  scraped_at      timestamptz default now(),
  scrape_method   text default 'api'         -- 'api', 'playwright', 'manual'
);

create index idx_rate_snapshots_property  on rate_snapshots(property_id);
create index idx_rate_snapshots_checkin   on rate_snapshots(check_in);

-- Materialised view for the Direct-Rate Verification component
create materialized view latest_rate_intelligence as
  select distinct on (property_id)
    property_id,
    protocol_rate,
    expedia_rate,
    booking_rate,
    direct_rate,
    commission_saved,
    commission_tax_visual,
    scraped_at
  from rate_snapshots
  order by property_id, scraped_at desc;

create unique index on latest_rate_intelligence(property_id);

-- ============================================================
-- SUBSCRIPTIONS — Zero-Commission Flat Fee Model
-- ============================================================

create table hotel_accounts (
  id              uuid primary key default uuid_generate_v4(),
  property_id     uuid not null references properties(id) on delete cascade unique,
  contact_name    text not null,
  contact_email   text not null,
  tier            subscription_tier not null default 'protocol_core',
  stripe_customer text,
  stripe_sub_id   text,
  billing_active  boolean default false,
  trial_ends_at   timestamptz,
  joined_at       timestamptz default now(),
  notes           text
);

-- ============================================================
-- SEARCH LOG — feed back into ranking improvements
-- ============================================================

create table search_queries (
  id              uuid primary key default uuid_generate_v4(),
  raw_query       text not null,
  parsed_intent   jsonb,          -- {borough, vibes[], tags[], past_life, nights}
  result_ids      uuid[],         -- ordered property IDs returned
  clicked_id      uuid,           -- which result the user clicked
  booked          boolean default false,
  session_id      text,
  created_at      timestamptz default now()
);

create index idx_search_queries_created on search_queries(created_at desc);

-- ============================================================
-- SEED: EXPERIENCE TAGS
-- ============================================================

insert into experience_tags (tag, category, aeo_weight, description) values
  ('reading-nook',            'spatial',  1.4, 'A dedicated alcove or corner designed for solitary reading'),
  ('vault-bedroom',           'salvage',  1.8, 'Guest room within a converted bank vault'),
  ('circadian-lighting',      'sensory',  1.5, 'Lighting system that shifts colour temperature with the sun'),
  ('exposed-riveted-steel',   'salvage',  1.3, 'Original Victorian or Edwardian structural steel left visible'),
  ('victorian-terrazzo',      'salvage',  1.2, 'Original hand-laid terrazzo floors retained from prior life'),
  ('warehouse-ceiling',       'spatial',  1.3, 'Raw industrial ceiling above 5m, often with original beams'),
  ('ghost-sign-wall',         'salvage',  1.6, 'Original painted wall signage from former commercial use'),
  ('former-church-nave',      'salvage',  1.9, 'Common area within the original nave of a converted church'),
  ('railway-arch-room',       'salvage',  1.7, 'Guest room within a restored Victorian railway arch'),
  ('scent-signature',         'sensory',  1.1, 'Property has a bespoke house scent diffused in public spaces'),
  ('blackout-curtains',       'sleep',    1.0, 'Blackout curtains or shutters for deep sleep'),
  ('no-ambient-music',        'sensory',  1.3, 'No background music played in public areas — true quiet'),
  ('local-roastery-coffee',   'food',     1.1, 'Coffee sourced from a named East or South London roastery'),
  ('residents-only-bar',      'social',   1.4, 'Bar or lounge accessible only to in-house guests'),
  ('cold-brew-on-tap',        'food',     1.0, 'Nitrogen cold brew available at all hours'),
  ('studio-desk-setup',       'work',     1.5, 'Desk and monitor arm designed for 8-hour work sessions'),
  ('analogue-library',        'spatial',  1.4, 'Curated physical book collection, not decorative'),
  ('neighbourhood-zine',      'local',    1.2, 'Original zine or guide written by local residents'),
  ('zero-checkout-anxiety',   'service',  1.0, 'No queuing — digital checkout, bags stored, walk straight out'),
  ('dog-friendly',            'amenity',  1.0, 'Dogs welcome with no surcharge'),
  ('power-shower-only',       'bathroom', 0.9, 'Shower-only rooms — no bath — for minimalists');

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table properties       enable row level security;
alter table past_lives        enable row level security;
alter table vibe_metrics      enable row level security;
alter table hotel_accounts    enable row level security;
alter table rate_snapshots    enable row level security;

-- Public can read active properties
create policy "Public read active properties"
  on properties for select
  using (is_active = true);

-- Only authenticated hotel accounts can edit their own property
create policy "Hotels manage own property"
  on properties for all
  using (auth.uid()::text = (
    select contact_email from hotel_accounts where property_id = id limit 1
  ));

-- ============================================================
-- FUNCTIONS
-- ============================================================

-- Auto-update updated_at
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_properties_updated_at
  before update on properties
  for each row execute function update_updated_at();

create trigger trg_swaps_updated_at
  before update on neighbourhood_swaps
  for each row execute function update_updated_at();

-- Compute commission savings for the UI verification component
create or replace function compute_commission_tax(
  p_protocol_rate numeric,
  p_expedia_rate  numeric,
  p_commission_pct numeric default 25.0
)
returns jsonb language plpgsql as $$
declare
  commission_amount numeric;
  saving            numeric;
  pct_saving        numeric;
begin
  commission_amount := p_expedia_rate * (p_commission_pct / 100);
  saving            := p_expedia_rate - p_protocol_rate;
  pct_saving        := round((saving / p_expedia_rate) * 100, 1);

  return jsonb_build_object(
    'protocol_rate',      p_protocol_rate,
    'expedia_rate',       p_expedia_rate,
    'commission_amount',  round(commission_amount, 2),
    'you_save',           round(saving, 2),
    'saving_pct',         pct_saving,
    'expedia_cut_label',  '£' || round(commission_amount, 2) || ' goes to Expedia',
    'protocol_label',     'You save £' || round(saving, 2) || ' (' || pct_saving || '%) booking direct'
  );
end;
$$;
