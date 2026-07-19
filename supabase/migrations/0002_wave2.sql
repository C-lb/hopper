-- supabase/migrations/0002_wave2.sql
-- Wave 2: purchase fields, condition enum recreate, categories, user_settings

alter table purchases
  add column serial_number text,
  add column website_url text,
  add column shipping_fee numeric;

-- Recreate condition enum to exactly (new, defective, refurbished, A, B, C, D).
-- No prod data exists; any unmapped old value falls back to 'new'.
create type purchase_condition_v2 as enum ('new','defective','refurbished','A','B','C','D');

alter table purchases alter column condition drop default;

alter table purchases
  alter column condition type purchase_condition_v2
  using (
    case
      when condition::text in ('new','defective','refurbished','A','B','C','D')
        then condition::text::purchase_condition_v2
      else 'new'::purchase_condition_v2
    end
  );

alter table purchases alter column condition set default 'new'::purchase_condition_v2;

drop type purchase_condition;
alter type purchase_condition_v2 rename to purchase_condition;

-- categories: per-user editable categories
create table categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);
create index categories_user_idx on categories(user_id);

alter table categories enable row level security;
create policy "own categories" on categories
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- user_settings: About/settings page
create table user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  default_location_name text,
  default_location_lat numeric,
  default_location_lng numeric,
  default_timezone text,
  auto_use_timezone boolean not null default true,
  default_currency char(3),
  display_default_currency boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table user_settings enable row level security;
create policy "own settings" on user_settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
