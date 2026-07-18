-- supabase/migrations/0001_init.sql
create extension if not exists pgcrypto;

create table body_profile (
  user_id uuid primary key references auth.users(id) on delete cascade,
  height_cm numeric, weight_kg numeric,
  chest_cm numeric, waist_cm numeric, hips_cm numeric,
  inseam_cm numeric, shoulder_cm numeric, foot_length_cm numeric,
  notes text,
  updated_at timestamptz not null default now()
);

create type purchase_condition as enum ('new','like-new','used','refurbished');

create table purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  item_name text not null,
  brand text,
  category text,
  condition purchase_condition not null default 'new',
  size text,
  purchased_at timestamptz not null,
  price_amount numeric not null,
  price_currency char(3) not null,
  display_currency char(3),
  fx_rate numeric,
  fx_rate_date date,
  converted_amount numeric,
  location_name text,
  location_lat numeric,
  location_lng numeric,
  photo_url text,
  msrp_amount numeric,
  msrp_currency char(3),
  savings_amount numeric,
  savings_currency char(3),
  recommended_size text,
  recommended_size_rationale text,
  source_url text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index purchases_user_idx on purchases(user_id);

create table item_lookup_cache (
  id uuid primary key default gen_random_uuid(),
  query_key text unique not null,
  result_json jsonb not null,
  fetched_at timestamptz not null default now()
);

alter table body_profile enable row level security;
alter table purchases enable row level security;
alter table item_lookup_cache enable row level security;

create policy "own profile" on body_profile
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own purchases" on purchases
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- cache is shared read, authenticated write
create policy "cache read" on item_lookup_cache for select using (auth.role() = 'authenticated');
create policy "cache write" on item_lookup_cache for insert with check (auth.role() = 'authenticated');
create policy "cache update" on item_lookup_cache for update using (auth.role() = 'authenticated');
