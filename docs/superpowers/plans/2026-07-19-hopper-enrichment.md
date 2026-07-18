# Hopper Enrichment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the `Look up` button real — given an item name + brand, fetch a product photo, MSRP, and size chart from the brand's official site (falling back to authorised e-commerce), then recommend a size from the user's body measurements. All results pre-fill the purchase form and stay editable.

**Architecture:** A server-side lookup pipeline behind `POST /api/lookup`. Stage 1 searches with Tavily (domain-ranked: brand official → authorised sellers). Stage 2 fetches the best page content; if Tavily's content is empty/blocked it retries the fetch through the Oxylabs residential proxy. Stage 3 sends the page content to ai& (OpenAI-compatible, Kimi K2.7) which returns structured `{photo_url, msrp, size_chart, source_url}`. Stage 4, if a size chart and body profile exist, asks ai& for a recommended size + rationale. Results cache to `item_lookup_cache`. Every stage degrades to "manual entry" on failure — nothing blocks the form.

**Tech Stack:** Next.js route handlers, `openai` SDK pointed at ai&, Tavily REST API, Oxylabs residential proxy via `undici` ProxyAgent, Zod for response validation, Vitest.

## Global Constraints

- Inherits all constraints from the Foundation plan (metric units, RLS, secrets in `.env.local`, no em dashes in copy).
- **Server-only keys:** `TAVILY_API_KEY`, `AIAND_API_KEY`, `OXYLABS_*` are used only in route handlers, never shipped to the browser.
- **ai& config:** base `https://api.aiand.com/v1`, model `moonshotai/kimi-k2.7-code`, OpenAI-compatible.
- **Never trust the model's JSON blindly:** every ai& response is validated with Zod; a validation failure is treated as a lookup miss (manual entry), not a crash.
- **Best-effort text only:** parse size charts that appear in page text/JSON. Image-only charts → skip recommendation, tell the user to enter size manually. No OCR in this plan.
- **Cost guard:** cap page content sent to ai& at ~12k characters (truncate), and cap Tavily to the top 5 results.

---

## File Structure

```
hopper/
  lib/enrichment/
    tavily.ts        # search(query) -> ranked results
    fetchPage.ts     # getPageContent(url) with oxylabs fallback
    aiand.ts         # openai client + extract() + recommendSize()
    ranking.ts       # domain ranking helper (pure, testable)
    schema.ts        # zod schemas for extraction + recommendation
  app/api/lookup/route.ts   # POST orchestrator
  components/PurchaseForm.tsx  # MODIFY: wire the Look up button
  tests/
    ranking.test.ts
    schema.test.ts
    aiand.test.ts
```

---

## Task 1: Domain ranking (pure, TDD)

**Files:**
- Create: `lib/enrichment/ranking.ts`
- Test: `tests/ranking.test.ts`

**Interfaces:**
- Produces: `rankResults(results: {url:string; content:string}[], brand: string): {url:string; content:string; score:number}[]` — sorted desc. Scoring: brand domain match (host contains brand slug) = +100; authorised marketplace host (amazon., ebay.) = +40; everything else = +0. Stable sort.

- [ ] **Step 1: Write failing test**

```ts
// tests/ranking.test.ts
import { expect, test } from 'vitest'
import { rankResults } from '@/lib/enrichment/ranking'
test('brand official ranks above amazon above random', () => {
  const r = rankResults([
    { url: 'https://random.blog/x', content: 'a' },
    { url: 'https://www.amazon.com/dp/1', content: 'b' },
    { url: 'https://nike.com/t/shoe', content: 'c' },
  ], 'Nike')
  expect(r.map(x => new URL(x.url).host)).toEqual(['nike.com', 'www.amazon.com', 'random.blog'])
})
```

- [ ] **Step 2: Run — expect fail.**

- [ ] **Step 3: Implement**

```ts
// lib/enrichment/ranking.ts
const MARKETS = ['amazon.', 'ebay.']
export function rankResults(results: {url:string; content:string}[], brand: string) {
  const slug = brand.toLowerCase().replace(/[^a-z0-9]/g, '')
  return results
    .map(r => {
      const host = (() => { try { return new URL(r.url).host.toLowerCase() } catch { return '' } })()
      let score = 0
      if (slug && host.replace(/[^a-z0-9]/g, '').includes(slug)) score += 100
      if (MARKETS.some(m => host.includes(m))) score += 40
      return { ...r, score }
    })
    .sort((a, b) => b.score - a.score)
}
```

- [ ] **Step 4: Run — expect pass. Commit**

```bash
git add lib/enrichment/ranking.ts tests/ranking.test.ts && git commit -m "feat: domain ranking for lookup results"
```

---

## Task 2: Zod schemas (TDD)

**Files:**
- Create: `lib/enrichment/schema.ts`
- Test: `tests/schema.test.ts`

**Interfaces:**
- Consumes: `zod` (add dep: `npm i zod`).
- Produces:
  - `ExtractionSchema` → `{ photo_url: string|null, msrp: {amount:number, currency:string}|null, size_chart: string|null, source_url: string|null }`.
  - `RecommendationSchema` → `{ recommended_size: string, rationale: string }`.
  - `safeExtract(json: unknown)` returns `ExtractionResult | null` (null on invalid).

- [ ] **Step 1: Write failing tests**

```ts
// tests/schema.test.ts
import { expect, test } from 'vitest'
import { safeExtract } from '@/lib/enrichment/schema'
test('valid extraction passes', () => {
  const out = safeExtract({ photo_url: 'http://x/y.jpg', msrp: { amount: 40, currency: 'USD' }, size_chart: null, source_url: 'http://x' })
  expect(out?.msrp?.amount).toBe(40)
})
test('missing fields default to null', () => {
  const out = safeExtract({})
  expect(out).toEqual({ photo_url: null, msrp: null, size_chart: null, source_url: null })
})
test('garbage returns null', () => {
  expect(safeExtract({ msrp: { amount: 'free' } })).toBeNull()
})
```

- [ ] **Step 2: Run — expect fail.**

- [ ] **Step 3: Implement**

```ts
// lib/enrichment/schema.ts
import { z } from 'zod'
export const ExtractionSchema = z.object({
  photo_url: z.string().url().nullable().default(null),
  msrp: z.object({ amount: z.number(), currency: z.string().length(3) }).nullable().default(null),
  size_chart: z.string().nullable().default(null),
  source_url: z.string().url().nullable().default(null),
})
export const RecommendationSchema = z.object({
  recommended_size: z.string(), rationale: z.string(),
})
export type ExtractionResult = z.infer<typeof ExtractionSchema>
export function safeExtract(json: unknown): ExtractionResult | null {
  const r = ExtractionSchema.safeParse(json ?? {})
  return r.success ? r.data : null
}
```

- [ ] **Step 4: Run — expect pass. Commit**

```bash
git add lib/enrichment/schema.ts tests/schema.test.ts package.json && git commit -m "feat: zod schemas for lookup extraction"
```

---

## Task 3: Tavily search client

**Files:**
- Create: `lib/enrichment/tavily.ts`

**Interfaces:**
- Produces: `tavilySearch(query: string): Promise<{url:string; content:string}[]>` — POSTs to `https://api.tavily.com/search` with `TAVILY_API_KEY`, `search_depth:'advanced'`, `max_results:5`, `include_raw_content:true`. Returns `[{url, content}]` (content = `raw_content ?? content`). Returns `[]` on any error.

- [ ] **Step 1: Implement**

```ts
// lib/enrichment/tavily.ts
export async function tavilySearch(query: string): Promise<{url:string; content:string}[]> {
  try {
    const r = await fetch('https://api.tavily.com/search', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: process.env.TAVILY_API_KEY, query,
        search_depth: 'advanced', max_results: 5, include_raw_content: true,
      }),
    })
    if (!r.ok) return []
    const j = await r.json()
    return (j.results ?? []).map((x: any) => ({ url: x.url, content: x.raw_content ?? x.content ?? '' }))
  } catch { return [] }
}
```

- [ ] **Step 2: Manual verify** with a real query via a scratch script (`node --env-file=.env.local ...`), confirm results returned.

- [ ] **Step 3: Commit**

```bash
git add lib/enrichment/tavily.ts && git commit -m "feat: tavily search client"
```

---

## Task 4: Page fetch with Oxylabs fallback

**Files:**
- Create: `lib/enrichment/fetchPage.ts`

**Interfaces:**
- Produces: `getPageContent(url: string, tavilyContent: string): Promise<string>` — if `tavilyContent` is non-empty (>200 chars), return it truncated to 12k. Otherwise fetch `url` directly; if that fails or the host is amazon/ebay, retry through the Oxylabs residential proxy (`undici` ProxyAgent, creds `OXYLABS_USERNAME`/`OXYLABS_PASSWORD`, proxy `OXYLABS_PROXY`). Strip HTML tags to text. Return truncated text, or `''` on total failure.

- [ ] **Step 1: Implement**

```ts
// lib/enrichment/fetchPage.ts
import { ProxyAgent } from 'undici'
const CAP = 12000
const strip = (html: string) => html.replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ').trim().slice(0, CAP)

async function viaOxylabs(url: string): Promise<string> {
  const { OXYLABS_USERNAME, OXYLABS_PASSWORD, OXYLABS_PROXY } = process.env
  if (!OXYLABS_USERNAME || !OXYLABS_PROXY) return ''
  const dispatcher = new ProxyAgent({
    uri: `http://${OXYLABS_PROXY}`,
    token: 'Basic ' + Buffer.from(`${OXYLABS_USERNAME}:${OXYLABS_PASSWORD}`).toString('base64'),
  })
  try {
    // @ts-expect-error undici dispatcher option
    const r = await fetch(url, { dispatcher })
    return r.ok ? strip(await r.text()) : ''
  } catch { return '' }
}

export async function getPageContent(url: string, tavilyContent: string): Promise<string> {
  if (tavilyContent && tavilyContent.length > 200) return tavilyContent.slice(0, CAP)
  const host = (() => { try { return new URL(url).host } catch { return '' } })()
  const needsProxy = /amazon\.|ebay\./.test(host)
  if (!needsProxy) {
    try { const r = await fetch(url); if (r.ok) return strip(await r.text()) } catch {}
  }
  return viaOxylabs(url)
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/enrichment/fetchPage.ts && git commit -m "feat: page fetch with oxylabs fallback"
```

---

## Task 5: ai& extraction + size recommendation

**Files:**
- Create: `lib/enrichment/aiand.ts`
- Test: `tests/aiand.test.ts`

**Interfaces:**
- Consumes: `openai` SDK (`npm i openai`), `safeExtract`, `RecommendationSchema`, `BodyProfile`.
- Produces:
  - `extract(pageContent: string, sourceUrl: string): Promise<ExtractionResult|null>` — prompts ai& to return the extraction JSON; parses fenced/naked JSON; `safeExtract`s it.
  - `recommendSize(sizeChart: string, profile: BodyProfile): Promise<{recommended_size, rationale}|null>`.
  - `parseJsonLoose(text: string): unknown` (exported, pure, testable) — extracts the first `{...}` block from a model response, tolerating ```json fences.

- [ ] **Step 1: Write failing test for the pure parser**

```ts
// tests/aiand.test.ts
import { expect, test } from 'vitest'
import { parseJsonLoose } from '@/lib/enrichment/aiand'
test('parses fenced json', () => {
  expect(parseJsonLoose('sure:\n```json\n{"a":1}\n```')).toEqual({ a: 1 })
})
test('parses naked json', () => {
  expect(parseJsonLoose('here {"b":2} done')).toEqual({ b: 2 })
})
test('returns null on none', () => {
  expect(parseJsonLoose('no json here')).toBeNull()
})
```

- [ ] **Step 2: Run — expect fail.**

- [ ] **Step 3: Implement**

```ts
// lib/enrichment/aiand.ts
import OpenAI from 'openai'
import type { BodyProfile } from '@/lib/types'
import { safeExtract, RecommendationSchema, type ExtractionResult } from './schema'

const client = new OpenAI({ apiKey: process.env.AIAND_API_KEY, baseURL: process.env.AIAND_BASE_URL })
const MODEL = process.env.AIAND_MODEL || 'moonshotai/kimi-k2.7-code'

export function parseJsonLoose(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  const body = fenced ? fenced[1] : text
  const start = body.indexOf('{'); const end = body.lastIndexOf('}')
  if (start === -1 || end === -1 || end < start) return null
  try { return JSON.parse(body.slice(start, end + 1)) } catch { return null }
}

async function ask(system: string, user: string): Promise<string> {
  const r = await client.chat.completions.create({
    model: MODEL, temperature: 0,
    messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
  })
  return r.choices[0]?.message?.content ?? ''
}

export async function extract(pageContent: string, sourceUrl: string): Promise<ExtractionResult|null> {
  const sys = 'You extract product data from web page text. Reply ONLY with JSON matching: ' +
    '{ "photo_url": string|null, "msrp": {"amount": number, "currency": 3-letter code}|null, ' +
    '"size_chart": string|null (raw size chart as plain text, null if none in the text), "source_url": string|null }. ' +
    'Use the list price / MSRP, not a discounted price. photo_url must be a direct image URL. No prose.'
  try {
    const out = parseJsonLoose(await ask(sys, `SOURCE_URL: ${sourceUrl}\n\nPAGE:\n${pageContent}`))
    const res = safeExtract(out)
    if (res && !res.source_url) res.source_url = sourceUrl
    return res
  } catch { return null }
}

export async function recommendSize(sizeChart: string, profile: BodyProfile) {
  const sys = 'You recommend a clothing size. Given a size chart and body measurements (cm/kg), ' +
    'reply ONLY with JSON: { "recommended_size": string, "rationale": string (one sentence) }.'
  const body = `SIZE CHART:\n${sizeChart}\n\nMEASUREMENTS(cm/kg):\n${JSON.stringify(profile)}`
  try {
    const out = parseJsonLoose(await ask(sys, body))
    const r = RecommendationSchema.safeParse(out)
    return r.success ? r.data : null
  } catch { return null }
}
```

- [ ] **Step 4: Run tests — expect pass. Commit**

```bash
git add lib/enrichment/aiand.ts tests/aiand.test.ts package.json && git commit -m "feat: ai& extraction + size recommendation"
```

---

## Task 6: Lookup orchestrator route

**Files:**
- Create: `app/api/lookup/route.ts`

**Interfaces:**
- Consumes: `tavilySearch`, `rankResults`, `getPageContent`, `extract`, `recommendSize`, `createServerSupabase`, `item_lookup_cache`.
- Produces: `POST /api/lookup` body `{ item_name, brand }` → `{ photo_url, msrp, size_chart, source_url, recommended_size, recommended_size_rationale }` (fields null on miss). Auth required. Read-through cache on `query_key = lower(brand|item_name)`.

- [ ] **Step 1: Implement the orchestrator**

```ts
// app/api/lookup/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { tavilySearch } from '@/lib/enrichment/tavily'
import { rankResults } from '@/lib/enrichment/ranking'
import { getPageContent } from '@/lib/enrichment/fetchPage'
import { extract, recommendSize } from '@/lib/enrichment/aiand'

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { item_name, brand } = await req.json()
  if (!item_name) return NextResponse.json({ error: 'item_name required' }, { status: 400 })
  const key = `${(brand ?? '').toLowerCase()}|${item_name.toLowerCase()}`.trim()

  const { data: cached } = await supabase.from('item_lookup_cache').select('result_json').eq('query_key', key).maybeSingle()
  const THIRTY_DAYS = 30 * 864e5
  let base = cached?.result_json ?? null

  if (!base) {
    const results = rankResults(await tavilySearch(`${brand ?? ''} ${item_name} price size chart`), brand ?? '')
    for (const top of results.slice(0, 3)) {
      const content = await getPageContent(top.url, top.content)
      if (!content) continue
      const ex = await extract(content, top.url)
      if (ex && (ex.photo_url || ex.msrp || ex.size_chart)) { base = ex; break }
    }
    if (base) await supabase.from('item_lookup_cache').upsert({ query_key: key, result_json: base, fetched_at: new Date().toISOString() })
  }

  const result = base ?? { photo_url: null, msrp: null, size_chart: null, source_url: null }

  // size recommendation (live, not cached — depends on this user's body profile)
  let recommended_size: string | null = null, recommended_size_rationale: string | null = null
  if (result.size_chart) {
    const { data: profile } = await supabase.from('body_profile').select('*').eq('user_id', user.id).maybeSingle()
    if (profile) {
      const rec = await recommendSize(result.size_chart, profile)
      if (rec) { recommended_size = rec.recommended_size; recommended_size_rationale = rec.rationale }
    }
  }
  return NextResponse.json({ ...result, recommended_size, recommended_size_rationale })
}
```

- [ ] **Step 2: Manual verify** — logged in, `curl -XPOST /api/lookup -d '{"item_name":"Air Force 1","brand":"Nike"}'` returns a photo_url + msrp (or nulls, gracefully).

- [ ] **Step 3: Commit**

```bash
git add app/api/lookup/route.ts && git commit -m "feat: lookup orchestrator with cache + graceful degrade"
```

---

## Task 7: Wire the Look up button in PurchaseForm

**Files:**
- Modify: `components/PurchaseForm.tsx`

**Interfaces:**
- Consumes: `POST /api/lookup`.
- Produces: clicking `Look up` (enabled when item_name present) posts, shows a spinner, and merges non-null returned fields into the form state. Every field remains editable. A miss shows a small note "couldn't find details, enter manually". A returned `recommended_size` renders below the size field with its rationale as helper text and a "use this" button that fills the size field.

- [ ] **Step 1: Replace the no-op Look up handler**

```tsx
async function handleLookup() {
  setLookingUp(true); setLookupNote(null)
  try {
    const r = await fetch('/api/lookup', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item_name: form.item_name, brand: form.brand }) })
    const d = await r.json()
    setForm(f => ({ ...f,
      photo_url: d.photo_url ?? f.photo_url,
      msrp_amount: d.msrp?.amount ?? f.msrp_amount,
      msrp_currency: d.msrp?.currency ?? f.msrp_currency,
      source_url: d.source_url ?? f.source_url,
    }))
    setRecommendation(d.recommended_size ? { size: d.recommended_size, why: d.recommended_size_rationale } : null)
    if (!d.photo_url && !d.msrp && !d.size_chart) setLookupNote('couldn\'t find details, enter manually')
  } catch { setLookupNote('lookup failed, enter manually') }
  finally { setLookingUp(false) }
}
```

- [ ] **Step 2: Render the recommendation UI + spinner state** (button disabled while `lookingUp`; recommendation block with a "use this" that sets `form.size`).

- [ ] **Step 3: Manual verify** — real item populates photo + MSRP + a recommended size; savings badge appears on the resulting catalogue card.

- [ ] **Step 4: Commit + redeploy**

```bash
git add components/PurchaseForm.tsx && git commit -m "feat: wire live lookup into purchase form"
git push
```

---

## Self-Review Notes

- **Spec coverage:** brand-official-first ranking ✓ (T1), authorised-seller fallback ✓ (T1 marketplace score + T4 oxylabs), photo ✓, MSRP ✓, size chart best-effort text ✓ (T5), size recommendation from body profile ✓ (T5-T6), savings computed from MSRP (Foundation T11 already does this once `msrp_amount` is populated), cache ✓ (T6), graceful degrade at every stage ✓.
- **Not trusting the model:** Zod validation (T2) + loose JSON parse with null fallback (T5).
- **Image-only size charts:** intentionally unsupported (returns null size_chart → no recommendation → manual size entry).
- **Type consistency:** `ExtractionResult` shape is identical across `schema.ts`, `aiand.ts`, and the route. `rankResults` input `{url, content}` matches `tavilySearch` output.
