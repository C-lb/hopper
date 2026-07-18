import OpenAI from 'openai'
import type { BodyProfile } from '@/lib/types'
import { safeExtract, RecommendationSchema, type ExtractionResult } from './schema'

const MODEL = process.env.AIAND_MODEL || 'moonshotai/kimi-k2.7-code'

// Lazy-init: constructing OpenAI() eagerly at module load throws when
// AIAND_API_KEY is unset, which would break importing parseJsonLoose
// (a pure function) in contexts/tests where env vars aren't configured.
let _client: OpenAI | null = null
function getClient(): OpenAI {
  if (!_client) {
    _client = new OpenAI({ apiKey: process.env.AIAND_API_KEY, baseURL: process.env.AIAND_BASE_URL })
  }
  return _client
}

export function parseJsonLoose(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  const body = fenced ? fenced[1] : text
  const start = body.indexOf('{'); const end = body.lastIndexOf('}')
  if (start === -1 || end === -1 || end < start) return null
  try { return JSON.parse(body.slice(start, end + 1)) } catch { return null }
}

async function ask(system: string, user: string): Promise<string> {
  const r = await getClient().chat.completions.create({
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
