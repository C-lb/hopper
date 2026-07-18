# Hopper — Design Spec

**Date:** 2026-07-19
**Status:** Approved design, pre-implementation
**Repo:** `hopper` (public GitHub, deploys to Vercel)

## What it is

Hopper is a personal purchase catalogue. You log the things you buy — item,
price, when, where, size, condition — and Hopper enriches each entry: it finds a
clear product photo, the MSRP (so you can see how much you saved), a recommended
size based on your body measurements and the item's size chart, a second-currency
conversion at the historical FX rate for the purchase date, and it plots every
purchase location on a map so your frequented shopping hotspots surface.

Multi-user, so anyone can sign up and keep their own catalogue.

## Stack

- **Frontend + backend:** Next.js (App Router) on Vercel.
- **Database + auth:** Supabase (Postgres, Supabase Auth, row-level security).
- **Map:** Leaflet + OpenStreetMap tiles (no key, no billing) with marker
  clustering for hotspots.
- **Reasoning model:** ai& (aiand), OpenAI-compatible endpoint. Called via the
  OpenAI SDK pointed at ai&'s base URL. Used for extraction + size recommendation.
  Base URL / API key / model id come from env (`AIAND_BASE_URL`, `AIAND_API_KEY`,
  `AIAND_MODEL`); pull actual values from the Daytona HackSprint access notes at
  implementation time.
- **Web search:** Tavily (free tier) — LLM-oriented search that returns clean
  page content and supports domain ranking.
- **Scrape fallback:** Oxylabs residential proxy (already available) for fetching
  e-commerce pages (Amazon/eBay) that block plain requests. Used only when Tavily's
  returned content is empty/blocked.
- **FX:** Frankfurter (free, ECB-backed, historical dates, no key).
- **Geocoding:** OpenStreetMap Nominatim (free) for place search + autocomplete →
  lat/lng.
- **Testing:** Vitest (unit) + Playwright (smoke).

## Branding

- Name: **Hopper**.
- Logo: a **simple flat-vector rabbit** (single-colour silhouette / minimal line
  style, no gradients, no 3D). Used as favicon and app mark. Follows the
  anti-vibecode house rules (one accent colour over neutral greys, flat, no shine).

## Data model

All tables carry `user_id` and are protected by RLS so each user sees only their
own rows.

### `body_profile` (one row per user)
- `user_id` (pk, fk auth.users)
- `height_cm`, `weight_kg`
- `chest_cm`, `waist_cm`, `hips_cm`, `inseam_cm`, `shoulder_cm`, `foot_length_cm`
- `notes` (free text — fit preferences, e.g. "prefer loose")
- `updated_at`

All measurement fields nullable; recommendation quality scales with how much is
filled in.

### `purchases`
- `id` (pk), `user_id` (fk)
- `item_name`, `brand`, `category` (e.g. clothing, shoes, electronics, other)
- `condition` (enum: new, like-new, used, refurbished)
- `size` (text, nullable — clothing/shoes only)
- `purchased_at` (timestamptz)
- `price_amount` (numeric), `price_currency` (char 3)
- `display_currency` (char 3), `fx_rate` (numeric, snapshotted),
  `fx_rate_date` (date), `converted_amount` (numeric)
- `location_name` (text), `location_lat` (numeric), `location_lng` (numeric)
- `photo_url` (text)
- `msrp_amount` (numeric), `msrp_currency` (char 3)
- `savings_amount` (numeric), `savings_currency` (char 3) — MSRP minus price,
  normalised to one currency
- `recommended_size` (text), `recommended_size_rationale` (text)
- `source_url` (text — where lookup data came from)
- `notes` (text)
- `created_at`, `updated_at`

### `item_lookup_cache`
- `id` (pk)
- `query_key` (text, normalised brand+item), unique
- `result_json` (jsonb — `{ photo_url, msrp, size_chart, source_url }`)
- `fetched_at`

Cache is global (not per-user) and read-through, so repeat lookups of the same
item skip the network. TTL: 30 days.

## Pages

1. **Auth** — Supabase email/password sign-up + login. (Social login is a later
   nice-to-have, not v1.)
2. **My measurements** — the `body_profile` form. Metric units for v1.
3. **Add / edit purchase** — the core flow (below).
4. **Catalogue** — filterable grid + list toggle of every purchase. Each card
   shows the product photo, item name, price in both currencies, condition, and a
   "saved $X vs MSRP" badge. Filters: category, currency, condition, date range,
   text search.
5. **Map** — Leaflet map of all purchase locations with clustering; clicking a
   cluster/pin shows the items bought there. Surfaces frequented hotspots.
6. **Dashboard** — totals: lifetime spend (in a chosen home currency), total saved
   vs MSRP, spend by category, spend by currency, count of items. Single-axis bar
   charts per the dataviz house style.

## The add-purchase flow

1. User enters at least `item_name` (+ optional `brand`) and taps **Look up**.
2. **Search** — Tavily query for the item, results ranked to prefer the brand's
   official domain first, then authorised e-commerce (Amazon/eBay authorised
   sellers). Cache checked first (`item_lookup_cache`).
3. **Extract** — best page content passed to ai&, which returns structured JSON:
   `{ photo_url, msrp: {amount, currency}, size_chart, source_url }`. Best-effort
   **text** extraction of the size chart; image-only charts are out of scope for
   v1 (fall back to manual).
4. **Recommend size** — if a size chart was extracted and the user has a
   `body_profile`, ai& compares the two and returns `{ recommended_size,
   rationale }`. Clothing/shoes only.
5. **Pre-fill** — every fetched field lands in the form, **editable**. Nothing is
   saved until the user confirms.
6. **Price + FX** — on price entry the user picks `price_currency` and
   `display_currency`. Hopper calls Frankfurter for the rate on `purchased_at`'s
   date, computes `converted_amount`, and snapshots `fx_rate` + `fx_rate_date` so
   the displayed conversion never drifts.
7. **Savings** — `msrp_amount − price_amount`, normalised to one currency via the
   same FX source, stored as `savings_amount`.
8. **Location** — Nominatim autocomplete: user types a store/place, picks a
   suggestion, Hopper stores `location_name` + `location_lat/lng`.

## Error handling

Every external dependency can fail; none may block a save.

- **Search / extract fails** → affected fields left blank for manual entry, with a
  visible "couldn't fetch — enter manually" note.
- **Size chart unreadable** → recommendation skipped, user enters size manually.
- **FX fails** → user can type the rate by hand; converted amount computed locally.
- **Geocode fails** → text `location_name` kept without lat/lng (won't appear on
  map until fixed).
- **ai& returns malformed JSON** → caught, treated as a lookup failure (manual
  entry), logged.

## Testing

- **Vitest (unit):** FX conversion math, savings normalisation, ai&-extraction
  JSON parsing/validation against mocked responses, size-recommendation prompt
  input assembly.
- **Playwright (smoke):** add-purchase happy path (manual entry, no network),
  measurements save, catalogue render, map render.

## Explicitly out of scope for v1 (YAGNI)

- Image/OCR-based size chart parsing (text-only for now).
- Social login.
- Receipt scanning / auto-import from email or bank.
- Imperial unit toggle.
- Sharing catalogues between users.
- Native/iOS wrapper (web is responsive; Capacitor is a later option).

## Resolved config

- **ai&:** base URL `https://api.aiand.com/v1`, model `moonshotai/kimi-k2.7-code`,
  OpenAI-compatible (verified). Key stored in gitignored `.env` (`AIAND_API_KEY`),
  never committed. Alternate models available if we need to swap (GLM, Qwen,
  DeepSeek, gpt-oss).
- **Oxylabs:** residential proxy `pr.oxylabs.io:7777` with customer creds in
  `.env`. Fallback fetch for blocked e-commerce pages.

## Open items to resolve at implementation time

- Tavily API key (free tier signup — the one remaining key to obtain).
- Supabase project provisioning (create project, get URL + anon/service keys).
