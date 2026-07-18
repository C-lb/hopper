# Hopper Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A working multi-user purchase catalogue web app — log purchases manually with dual-currency (historical FX) pricing, body measurements profile, a filterable catalogue, a location hotspot map, and a totals dashboard.

**Architecture:** Next.js App Router app on Vercel. Supabase provides Postgres, Auth, and row-level security; the browser talks to Supabase directly for CRUD (RLS-guarded), while a few Next.js route handlers proxy keyless external APIs (Frankfurter FX, Nominatim geocode). Leaflet renders the map client-side. Enrichment (Tavily/ai&) is deliberately deferred to Plan 2 — this plan leaves clean seams (empty `photo_url`, `msrp_*`, `recommended_size` fields, a `Look up` button that is wired but no-op until Plan 2).

**Tech Stack:** Next.js 15 (App Router, TypeScript), Supabase JS v2, Leaflet + react-leaflet + leaflet.markercluster, Frankfurter API, Nominatim, Vitest, Playwright, Tailwind CSS.

## Global Constraints

- **Units:** metric only (cm, kg). No imperial toggle.
- **Multi-user:** every data table has `user_id`; RLS restricts every row to its owner. Never trust client-supplied `user_id` — derive from `auth.uid()` in policies.
- **Secrets:** all keys in gitignored `.env.local`. Never commit real keys. `SUPABASE_SERVICE_ROLE_KEY`, `AIAND_API_KEY`, `TAVILY_API_KEY`, Oxylabs creds are server-only (never `NEXT_PUBLIC_`).
- **FX snapshotting:** the FX rate and converted amount are computed once at save and stored; they must never be recomputed on read.
- **Design:** anti-vibecode house rules — one accent colour over neutral greys, flat buttons (no shine), soft shadows, generous spacing, sentence-case eyebrows, no em dashes in UI copy. Logo is a simple flat-vector rabbit.
- **Money math:** never use floating-point `number` for currency arithmetic in a way that rounds silently. Store as numeric in DB; in JS compute in integer minor units where feasible and round to 2 dp at the boundary.

---

## File Structure

```
hopper/
  .env.local.example          # documented env template (committed)
  package.json
  next.config.ts
  tailwind.config.ts
  app/
    layout.tsx                # root layout, fonts, nav shell
    page.tsx                  # redirect -> /catalogue or /login
    login/page.tsx            # auth (sign in / sign up)
    measurements/page.tsx     # body profile form
    purchases/new/page.tsx    # add purchase
    purchases/[id]/page.tsx   # edit purchase
    catalogue/page.tsx        # grid/list of purchases
    map/page.tsx              # leaflet hotspot map
    dashboard/page.tsx        # totals + charts
    api/fx/route.ts           # GET historical rate (Frankfurter proxy)
    api/geocode/route.ts      # GET place search (Nominatim proxy)
  lib/
    supabase/client.ts        # browser client
    supabase/server.ts        # server client (route handlers)
    money.ts                  # currency math + formatting
    fx.ts                     # fetchRate(), convert()
    geocode.ts                # searchPlaces()
    currencies.ts             # supported currency list
    types.ts                  # shared TS types (Purchase, BodyProfile)
  components/
    Logo.tsx                  # rabbit SVG
    NavShell.tsx              # side/top nav
    PurchaseForm.tsx          # shared add/edit form
    CurrencyField.tsx         # amount + currency + display-currency
    LocationField.tsx         # nominatim autocomplete
    PurchaseCard.tsx          # catalogue card
    Stat.tsx                  # dashboard stat tile
  supabase/
    migrations/0001_init.sql  # tables + RLS
  tests/
    money.test.ts
    fx.test.ts
    e2e/add-purchase.spec.ts
```

---

## Task 1: Project scaffold + tooling

**Files:**
- Create: `package.json`, `next.config.ts`, `tailwind.config.ts`, `tsconfig.json`, `app/layout.tsx`, `app/page.tsx`, `.env.local.example`, `vitest.config.ts`
- Test: `tests/smoke.test.ts`

**Interfaces:**
- Produces: a runnable Next.js app (`npm run dev`), `npm test` (vitest), `npm run e2e` (playwright).

- [ ] **Step 1: Scaffold Next.js app**

```bash
cd ~/hopper
npx create-next-app@latest . --typescript --tailwind --app --eslint --no-src-dir --import-alias "@/*" --use-npm --yes
```

- [ ] **Step 2: Add deps**

```bash
npm i @supabase/supabase-js @supabase/ssr leaflet react-leaflet leaflet.markercluster
npm i -D vitest @vitejs/plugin-react jsdom @playwright/test @types/leaflet
```

- [ ] **Step 3: Add vitest config**

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config'
export default defineConfig({ test: { environment: 'jsdom', globals: true } })
```

- [ ] **Step 4: Add scripts to package.json**

```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "test": "vitest run",
  "e2e": "playwright test"
}
```

- [ ] **Step 5: Write a smoke test and run it**

```ts
// tests/smoke.test.ts
import { expect, test } from 'vitest'
test('math sanity', () => { expect(1 + 1).toBe(2) })
```

Run: `npm test` — Expected: 1 passed.

- [ ] **Step 6: Write `.env.local.example`**

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
# Plan 2:
TAVILY_API_KEY=
AIAND_BASE_URL=https://api.aiand.com/v1
AIAND_MODEL=moonshotai/kimi-k2.7-code
AIAND_API_KEY=
OXYLABS_USERNAME=
OXYLABS_PASSWORD=
OXYLABS_PROXY=pr.oxylabs.io:7777
```

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "chore: scaffold Next.js app with vitest + playwright"
```

---

## Task 2: Database schema + RLS

**Files:**
- Create: `supabase/migrations/0001_init.sql`
- Test: manual verification via Supabase SQL editor (documented below)

**Interfaces:**
- Produces: tables `body_profile`, `purchases`, `item_lookup_cache` with RLS. Columns match `lib/types.ts` (Task 3).

- [ ] **Step 1: Write the migration**

```sql
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
```

- [ ] **Step 2: Create Supabase project + apply migration**

Create a project at supabase.com, copy URL + anon key + service role key into `.env.local`. In the SQL editor, paste and run `0001_init.sql`.

- [ ] **Step 3: Verify RLS**

Run in SQL editor: `select tablename, rowsecurity from pg_tables where schemaname='public';` — Expected: all three tables `rowsecurity = true`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0001_init.sql && git commit -m "feat: db schema + RLS"
```

---

## Task 3: Shared types + Supabase clients

**Files:**
- Create: `lib/types.ts`, `lib/supabase/client.ts`, `lib/supabase/server.ts`, `lib/currencies.ts`
- Test: `tests/types.test.ts` (compile-only sanity)

**Interfaces:**
- Produces:
  - `type BodyProfile` and `type Purchase` (matching Task 2 columns).
  - `createBrowserSupabase(): SupabaseClient` from `lib/supabase/client.ts`.
  - `createServerSupabase(): SupabaseClient` from `lib/supabase/server.ts`.
  - `CURRENCIES: {code: string; name: string}[]` from `lib/currencies.ts`.

- [ ] **Step 1: Write types**

```ts
// lib/types.ts
export type Condition = 'new' | 'like-new' | 'used' | 'refurbished'

export interface BodyProfile {
  user_id: string
  height_cm: number | null; weight_kg: number | null
  chest_cm: number | null; waist_cm: number | null; hips_cm: number | null
  inseam_cm: number | null; shoulder_cm: number | null; foot_length_cm: number | null
  notes: string | null; updated_at: string
}

export interface Purchase {
  id: string; user_id: string
  item_name: string; brand: string | null; category: string | null
  condition: Condition; size: string | null
  purchased_at: string
  price_amount: number; price_currency: string
  display_currency: string | null; fx_rate: number | null
  fx_rate_date: string | null; converted_amount: number | null
  location_name: string | null; location_lat: number | null; location_lng: number | null
  photo_url: string | null
  msrp_amount: number | null; msrp_currency: string | null
  savings_amount: number | null; savings_currency: string | null
  recommended_size: string | null; recommended_size_rationale: string | null
  source_url: string | null; notes: string | null
  created_at: string; updated_at: string
}
```

- [ ] **Step 2: Write currency list**

```ts
// lib/currencies.ts — Frankfurter-supported set
export const CURRENCIES = [
  { code: 'SGD', name: 'Singapore Dollar' }, { code: 'USD', name: 'US Dollar' },
  { code: 'EUR', name: 'Euro' }, { code: 'GBP', name: 'British Pound' },
  { code: 'JPY', name: 'Japanese Yen' }, { code: 'AUD', name: 'Australian Dollar' },
  { code: 'CNY', name: 'Chinese Yuan' }, { code: 'HKD', name: 'Hong Kong Dollar' },
  { code: 'KRW', name: 'South Korean Won' }, { code: 'MYR', name: 'Malaysian Ringgit' },
]
```

- [ ] **Step 3: Write browser + server clients**

```ts
// lib/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr'
export const createBrowserSupabase = () => createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
```

```ts
// lib/supabase/server.ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
export async function createServerSupabase() {
  const store = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => store.getAll(), setAll: (c) => c.forEach(({name,value,options}) => store.set(name,value,options)) } })
}
```

- [ ] **Step 4: Commit**

```bash
git add lib && git commit -m "feat: shared types + supabase clients + currency list"
```

---

## Task 4: Money math (TDD)

**Files:**
- Create: `lib/money.ts`
- Test: `tests/money.test.ts`

**Interfaces:**
- Produces:
  - `round2(n: number): number`
  - `formatMoney(amount: number, currency: string): string` (e.g. `formatMoney(12.5,'USD') => "$12.50"`, JPY has 0 dp).
  - `computeSavings(msrp: number, price: number): number` (>=0, clamped at 0).

- [ ] **Step 1: Write failing tests**

```ts
// tests/money.test.ts
import { expect, test } from 'vitest'
import { round2, formatMoney, computeSavings } from '@/lib/money'
test('round2 avoids float drift', () => { expect(round2(0.1 + 0.2)).toBe(0.3) })
test('formatMoney 2dp', () => { expect(formatMoney(12.5, 'USD')).toBe('$12.50') })
test('formatMoney JPY 0dp', () => { expect(formatMoney(1200, 'JPY')).toBe('¥1,200') })
test('savings positive', () => { expect(computeSavings(100, 60)).toBe(40) })
test('savings clamps at 0', () => { expect(computeSavings(50, 80)).toBe(0) })
```

- [ ] **Step 2: Run — expect fail** (`npm test tests/money.test.ts`) — "not defined".

- [ ] **Step 3: Implement**

```ts
// lib/money.ts
export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100
export function formatMoney(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount)
}
export const computeSavings = (msrp: number, price: number) => Math.max(0, round2(msrp - price))
```

- [ ] **Step 4: Run — expect pass. Commit**

```bash
git add lib/money.ts tests/money.test.ts && git commit -m "feat: money math (round2, formatMoney, computeSavings)"
```

---

## Task 5: FX rate fetch + conversion (TDD)

**Files:**
- Create: `lib/fx.ts`, `app/api/fx/route.ts`
- Test: `tests/fx.test.ts`

**Interfaces:**
- Consumes: `round2` from `lib/money.ts`.
- Produces:
  - `convert(amount: number, rate: number): number` (= `round2(amount * rate)`).
  - `fetchRate(from: string, to: string, date: string): Promise<{rate: number; date: string}>` — calls `/api/fx`. If `from === to`, returns `{rate:1, date}` without a network call.
  - Route `GET /api/fx?from=USD&to=SGD&date=2026-07-01` → `{rate, date}` proxying `https://api.frankfurter.app/{date}?from={from}&to={to}`.

- [ ] **Step 1: Write failing tests (convert is pure; fetchRate mocked)**

```ts
// tests/fx.test.ts
import { expect, test, vi } from 'vitest'
import { convert, fetchRate } from '@/lib/fx'
test('convert rounds to 2dp', () => { expect(convert(10, 1.345)).toBe(13.45) })
test('same currency short-circuits', async () => {
  const r = await fetchRate('USD','USD','2026-07-01')
  expect(r.rate).toBe(1)
})
test('fetchRate parses frankfurter shape', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ rates: { SGD: 1.34 }, date: '2026-07-01' }) })))
  const r = await fetchRate('USD','SGD','2026-07-01')
  expect(r.rate).toBe(1.34); expect(r.date).toBe('2026-07-01')
})
```

- [ ] **Step 2: Run — expect fail.**

- [ ] **Step 3: Implement lib/fx.ts**

```ts
// lib/fx.ts
import { round2 } from './money'
export const convert = (amount: number, rate: number) => round2(amount * rate)
export async function fetchRate(from: string, to: string, date: string) {
  if (from === to) return { rate: 1, date }
  const res = await fetch(`/api/fx?from=${from}&to=${to}&date=${date}`)
  if (!res.ok) throw new Error('fx failed')
  const j = await res.json()
  return { rate: j.rate as number, date: j.date as string }
}
```

Note: in tests, `fetchRate` for the SGD case calls `fetch` which is stubbed to return the frankfurter shape directly; the route parsing lives in the route handler. Adjust `fetchRate` test stub to return `{ rate, date }` shape to match `/api/fx`. (Use `{ ok:true, json: async()=>({rate:1.34,date:'2026-07-01'}) }` in the stub instead.)

- [ ] **Step 4: Implement route**

```ts
// app/api/fx/route.ts
import { NextRequest, NextResponse } from 'next/server'
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')!, to = searchParams.get('to')!, date = searchParams.get('date')!
  const r = await fetch(`https://api.frankfurter.app/${date}?from=${from}&to=${to}`)
  if (!r.ok) return NextResponse.json({ error: 'fx upstream failed' }, { status: 502 })
  const j = await r.json()
  return NextResponse.json({ rate: j.rates[to], date: j.date })
}
```

- [ ] **Step 5: Run — expect pass. Commit**

```bash
git add lib/fx.ts app/api/fx/route.ts tests/fx.test.ts && git commit -m "feat: FX fetch + convert via Frankfurter proxy"
```

---

## Task 6: Auth (login / signup)

**Files:**
- Create: `app/login/page.tsx`, `middleware.ts`
- Modify: `app/page.tsx` (redirect based on session)

**Interfaces:**
- Consumes: `createBrowserSupabase`, `createServerSupabase`.
- Produces: authenticated session cookie; unauthenticated users hitting protected routes redirect to `/login`.

- [ ] **Step 1: Write middleware guarding app routes**

```ts
// middleware.ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => req.cookies.getAll(), setAll: (c) => c.forEach(({name,value,options}) => res.cookies.set(name,value,options)) } })
  const { data: { user } } = await supabase.auth.getUser()
  const isAuthPage = req.nextUrl.pathname.startsWith('/login')
  if (!user && !isAuthPage) return NextResponse.redirect(new URL('/login', req.url))
  if (user && isAuthPage) return NextResponse.redirect(new URL('/catalogue', req.url))
  return res
}
export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico|api/).*)'] }
```

- [ ] **Step 2: Write login page (email/password, toggle sign in / sign up)**

Build a client component with two fields and a mode toggle. On submit call `supabase.auth.signInWithPassword` or `supabase.auth.signUp`. On success `router.push('/catalogue')`. Show inline error text on failure. Apply anti-vibecode styling (flat button, neutral surfaces, rabbit Logo at top).

- [ ] **Step 3: Manual verify**

Run `npm run dev`, visit `/catalogue` unauthenticated → redirected to `/login`. Sign up → lands on `/catalogue`.

- [ ] **Step 4: Commit**

```bash
git add app/login app/page.tsx middleware.ts && git commit -m "feat: email/password auth + route guard"
```

---

## Task 7: Logo + nav shell

**Files:**
- Create: `components/Logo.tsx`, `components/NavShell.tsx`, `app/icon.svg`
- Modify: `app/layout.tsx`

**Interfaces:**
- Produces: `<Logo size={n} />` flat-vector rabbit SVG; `<NavShell>` wrapping page content with links to Catalogue, Map, Dashboard, Measurements, and a sign-out button.

- [ ] **Step 1: Write the rabbit Logo SVG**

```tsx
// components/Logo.tsx — simple flat single-colour rabbit
export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="currentColor" aria-label="Hopper">
      <path d="M20 30c-3-8-4-18 1-19s7 8 8 15c2-1 4-1 6 0 1-7 3-16 8-15s4 11 1 19c5 3 8 8 8 14 0 8-8 13-20 13S12 52 12 44c0-6 3-11 8-14z"/>
      <circle cx="26" cy="42" r="2.4" fill="#fff"/><circle cx="38" cy="42" r="2.4" fill="#fff"/>
    </svg>
  )
}
```

(Refine the path in-browser until it reads clearly as a rabbit; keep it single flat fill, no gradient.)

- [ ] **Step 2: Write NavShell with the nav links + sign out**

Client component: renders `<Logo/>` + app name "Hopper", nav links, and a sign-out button calling `supabase.auth.signOut()` then `router.push('/login')`. Responsive: sidebar on desktop, bottom bar on mobile.

- [ ] **Step 3: Wrap layout, set favicon to the rabbit**

- [ ] **Step 4: Manual verify + commit**

```bash
git add components/Logo.tsx components/NavShell.tsx app/layout.tsx app/icon.svg && git commit -m "feat: rabbit logo + nav shell"
```

---

## Task 8: Measurements profile page

**Files:**
- Create: `app/measurements/page.tsx`
- Test: covered by e2e in Task 13

**Interfaces:**
- Consumes: `BodyProfile`, `createBrowserSupabase`.
- Produces: upserts a `body_profile` row for the current user.

- [ ] **Step 1: Build the form**

Client component. On mount, `select` the user's `body_profile` (may be empty). Render number inputs for each cm/kg field + a notes textarea. On save, `supabase.from('body_profile').upsert({ user_id: user.id, ...values })`. Show a success toast. All fields optional. Label units explicitly (cm, kg).

- [ ] **Step 2: Manual verify** — enter values, reload, values persist.

- [ ] **Step 3: Commit**

```bash
git add app/measurements && git commit -m "feat: body measurements profile"
```

---

## Task 9: Location autocomplete (Nominatim)

**Files:**
- Create: `lib/geocode.ts`, `app/api/geocode/route.ts`, `components/LocationField.tsx`
- Test: `tests/geocode.test.ts`

**Interfaces:**
- Produces:
  - `searchPlaces(q: string): Promise<{name: string; lat: number; lng: number}[]>` (calls `/api/geocode`).
  - Route `GET /api/geocode?q=...` proxies Nominatim with a required `User-Agent` header, returns `[{name, lat, lng}]`.
  - `<LocationField value onChange />` — debounced text input with a suggestions dropdown; selecting sets `{name, lat, lng}`.

- [ ] **Step 1: Write failing parse test**

```ts
// tests/geocode.test.ts
import { expect, test, vi } from 'vitest'
import { parseNominatim } from '@/lib/geocode'
test('parse nominatim rows', () => {
  const rows = [{ display_name: 'Uniqlo, Orchard', lat: '1.30', lon: '103.83' }]
  expect(parseNominatim(rows)).toEqual([{ name: 'Uniqlo, Orchard', lat: 1.3, lng: 103.83 }])
})
```

- [ ] **Step 2: Run — expect fail.**

- [ ] **Step 3: Implement lib/geocode.ts**

```ts
// lib/geocode.ts
export function parseNominatim(rows: any[]) {
  return rows.map(r => ({ name: r.display_name as string, lat: parseFloat(r.lat), lng: parseFloat(r.lon) }))
}
export async function searchPlaces(q: string) {
  if (q.trim().length < 3) return []
  const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`)
  if (!res.ok) return []
  return res.json()
}
```

- [ ] **Step 4: Implement route (Nominatim requires a User-Agent)**

```ts
// app/api/geocode/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { parseNominatim } from '@/lib/geocode'
export async function GET(req: NextRequest) {
  const q = new URL(req.url).searchParams.get('q') ?? ''
  const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=6&q=${encodeURIComponent(q)}`,
    { headers: { 'User-Agent': 'Hopper/1.0 (purchase catalogue)' } })
  if (!r.ok) return NextResponse.json([], { status: 200 })
  return NextResponse.json(parseNominatim(await r.json()))
}
```

- [ ] **Step 5: Build LocationField** — debounced (300ms) input, dropdown of results, click to select. On failure, keep typed text with no coords.

- [ ] **Step 6: Run tests — expect pass. Commit**

```bash
git add lib/geocode.ts app/api/geocode components/LocationField.tsx tests/geocode.test.ts && git commit -m "feat: nominatim location autocomplete"
```

---

## Task 10: CurrencyField component

**Files:**
- Create: `components/CurrencyField.tsx`

**Interfaces:**
- Consumes: `CURRENCIES`, `fetchRate`, `convert`, `formatMoney`.
- Produces: `<CurrencyField value onChange purchasedAt />` capturing `{price_amount, price_currency, display_currency}` and, when both currencies + date are set, live-previewing the converted amount via `fetchRate`/`convert`. Exposes the resolved `{fx_rate, fx_rate_date, converted_amount}` to the parent through `onChange`.

- [ ] **Step 1: Build the component**

Amount number input + two `<select>`s (paid currency, display currency, from `CURRENCIES`). On change of any of amount/currencies/date, if paid≠display and date present, call `fetchRate(paid, display, date)`, compute `convert(amount, rate)`, and surface `{fx_rate, fx_rate_date, converted_amount}` upward. Show a subtle live preview line: `formatMoney(amount, paid) + " ≈ " + formatMoney(converted, display)`. On FX error, show a small "rate unavailable, enter manually" with an editable rate input.

- [ ] **Step 2: Manual verify in a throwaway harness** (rendered on the new-purchase page in Task 11).

- [ ] **Step 3: Commit**

```bash
git add components/CurrencyField.tsx && git commit -m "feat: currency field with live FX preview"
```

---

## Task 11: Purchase form + new/edit pages

**Files:**
- Create: `components/PurchaseForm.tsx`, `app/purchases/new/page.tsx`, `app/purchases/[id]/page.tsx`
- Test: e2e in Task 13

**Interfaces:**
- Consumes: `PurchaseForm` uses `CurrencyField`, `LocationField`, `Purchase`, `createBrowserSupabase`, `computeSavings`, `convert`, `fetchRate`.
- Produces: inserts/updates a `purchases` row. Exposes a `Look up` button that is present but disabled/no-op with tooltip "Auto lookup arrives in the next update" (wired for real in Plan 2).

- [ ] **Step 1: Build PurchaseForm**

Fields: item_name (required), brand, category (`<select>`: clothing, shoes, electronics, homeware, other), condition (`<select>` enum), size (shown only when category ∈ {clothing, shoes}), purchased_at (datetime-local, default now), `<CurrencyField>`, `<LocationField>`, msrp_amount + msrp_currency, photo_url (text), notes. A `Look up` button (no-op placeholder). On submit:
  - compute `savings_amount` = `computeSavings(msrp_in_display_ccy, price_in_display_ccy)` when MSRP present (convert MSRP to display currency via `fetchRate` first); `savings_currency = display_currency ?? price_currency`.
  - assemble the row incl. snapshotted `fx_rate`, `fx_rate_date`, `converted_amount` from CurrencyField.
  - `supabase.from('purchases').insert(row)` (or `.update().eq('id', id)` in edit mode).
  - redirect to `/catalogue`.
  - Any external failure (FX, geocode) must not block submit — save what's available.

- [ ] **Step 2: Wire new + edit pages** — new renders empty form; `[id]` loads the row then renders the form in edit mode.

- [ ] **Step 3: Manual verify** — create a purchase with two currencies and a location; confirm row in Supabase has snapshotted fx fields + coords.

- [ ] **Step 4: Commit**

```bash
git add components/PurchaseForm.tsx app/purchases && git commit -m "feat: add/edit purchase form"
```

---

## Task 12: Catalogue, map, dashboard

**Files:**
- Create: `components/PurchaseCard.tsx`, `app/catalogue/page.tsx`, `app/map/page.tsx`, `app/dashboard/page.tsx`, `components/Stat.tsx`
- Test: e2e in Task 13

**Interfaces:**
- Consumes: `Purchase`, `createBrowserSupabase`, `formatMoney`, Leaflet.
- Produces: three read views over the user's purchases.

- [ ] **Step 1: PurchaseCard + catalogue**

Card shows `photo_url` (or a placeholder rabbit block when null), item_name, brand, `formatMoney(price_amount, price_currency)`, and when `converted_amount` present a secondary `formatMoney(converted_amount, display_currency)`, condition chip, and a "saved X" badge when `savings_amount>0`. Catalogue page fetches all purchases ordered by `purchased_at desc`, renders a responsive grid, and provides filters: text search (item/brand), category, condition, currency, date range. Grid/list toggle. Each card links to `/purchases/[id]`.

- [ ] **Step 2: Map page**

Client-only (dynamic import, `ssr:false`). Load purchases with non-null lat/lng, render Leaflet map with `leaflet.markercluster`. Fit bounds to markers. Clicking a marker shows a popup listing items bought there. Frequented spots naturally cluster with a count badge.

- [ ] **Step 3: Dashboard**

Pick a "home currency" selector (default SGD). For each purchase, use `converted_amount` when its `display_currency` matches home, else show native and note mixed currencies (v1: sum only rows already in home currency + a caveat line; keep it honest, no fake conversions on read). Stat tiles: item count, total spend (home ccy), total saved (sum `savings_amount` where `savings_currency`=home). Single-axis bar charts (spend by category, count by condition) per the dataviz house style.

- [ ] **Step 4: Manual verify all three views. Commit**

```bash
git add components/PurchaseCard.tsx components/Stat.tsx app/catalogue app/map app/dashboard && git commit -m "feat: catalogue, map, dashboard"
```

---

## Task 13: E2E smoke + deploy

**Files:**
- Create: `tests/e2e/add-purchase.spec.ts`, `playwright.config.ts`, `README.md`

**Interfaces:**
- Produces: a passing Playwright happy-path and a live Vercel deployment.

- [ ] **Step 1: Write the happy-path e2e (manual entry, no external network needed for the core save)**

```ts
// tests/e2e/add-purchase.spec.ts
import { test, expect } from '@playwright/test'
test('log a purchase and see it in the catalogue', async ({ page }) => {
  // sign in with a seeded test user (env-provided creds)
  await page.goto('/login')
  await page.getByLabel('Email').fill(process.env.E2E_EMAIL!)
  await page.getByLabel('Password').fill(process.env.E2E_PASSWORD!)
  await page.getByRole('button', { name: /sign in/i }).click()
  await page.goto('/purchases/new')
  await page.getByLabel('Item name').fill('Test Tee')
  await page.getByLabel(/amount/i).fill('20')
  await page.getByRole('button', { name: /save/i }).click()
  await expect(page.getByText('Test Tee')).toBeVisible()
})
```

- [ ] **Step 2: Run e2e against `npm run dev`** — expect pass.

- [ ] **Step 3: Write README** (setup, env vars, migration, run, deploy).

- [ ] **Step 4: Create public GitHub repo + push**

```bash
gh repo create hopper --public --source=. --remote=origin --push
```

- [ ] **Step 5: Deploy to Vercel** — import the repo, set all env vars, deploy. Verify the deployed app: sign up, log a purchase, see it on catalogue + map + dashboard.

- [ ] **Step 6: Commit**

```bash
git add tests/e2e playwright.config.ts README.md && git commit -m "test: e2e happy path + README + deploy"
```

---

## Self-Review Notes

- **Spec coverage:** auth ✓ (T6), measurements ✓ (T8), add/edit ✓ (T10-11), catalogue ✓ (T12), map ✓ (T12), dashboard ✓ (T12), FX historical + snapshot ✓ (T5, T11), location autocomplete ✓ (T9), dual currency ✓ (T10), condition/size/category ✓ (T11). Photo/MSRP/size-recommendation fields exist and are manually editable here; auto-population is Plan 2. RLS ✓ (T2). Testing ✓ (T4, T5, T9, T13).
- **Deferred to Plan 2 (intentional):** Tavily search, Oxylabs fallback, ai& extraction, size recommendation, `item_lookup_cache` writes, the real `Look up` behaviour.
- **Known follow-up:** dashboard cross-currency totals are honestly limited in v1 (sums only same-home-currency rows). A full multi-currency roll-up is a later enhancement.
