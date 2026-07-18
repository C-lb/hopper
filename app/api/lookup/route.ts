// app/api/lookup/route.ts
//
// Lookup orchestrator: given { item_name, brand }, read-through caches a
// product lookup (photo/msrp/size chart) in item_lookup_cache, then layers a
// live (uncached) size recommendation on top when a size chart and the
// user's body_profile are both present. Every external stage (Tavily, page
// fetch, ai&) already degrades to null/[] internally, so a lookup miss
// returns a null-filled 200 rather than a 500. Auth is enforced here because
// proxy.ts's matcher excludes /api.
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { tavilySearch } from '@/lib/enrichment/tavily'
import { rankResults } from '@/lib/enrichment/ranking'
import { getPageContent } from '@/lib/enrichment/fetchPage'
import { extract, recommendSize } from '@/lib/enrichment/aiand'
import type { ExtractionResult } from '@/lib/enrichment/schema'

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  let item_name: string | undefined
  let brand: string | undefined
  try {
    const body = await req.json()
    item_name = body?.item_name
    brand = body?.brand
  } catch {
    return NextResponse.json({ error: 'item_name required' }, { status: 400 })
  }
  if (!item_name) return NextResponse.json({ error: 'item_name required' }, { status: 400 })

  const key = `${(brand ?? '').toLowerCase()}|${item_name.toLowerCase()}`.trim()

  let base: ExtractionResult | null = null
  try {
    const { data: cached } = await supabase
      .from('item_lookup_cache')
      .select('result_json')
      .eq('query_key', key)
      .maybeSingle()
    base = (cached?.result_json as ExtractionResult | null) ?? null
  } catch {
    base = null
  }

  if (!base) {
    try {
      const raw = await tavilySearch(`${brand ?? ''} ${item_name} price size chart`)
      const results = rankResults(raw, brand ?? '')
      for (const top of results.slice(0, 3)) {
        try {
          const content = await getPageContent(top.url, top.content)
          if (!content) continue
          const ex = await extract(content, top.url)
          if (ex && (ex.photo_url || ex.msrp || ex.size_chart)) {
            base = ex
            break
          }
        } catch {
          continue
        }
      }
    } catch {
      base = null
    }

    if (base) {
      try {
        await supabase
          .from('item_lookup_cache')
          .upsert({ query_key: key, result_json: base, fetched_at: new Date().toISOString() })
      } catch {
        // cache write failure shouldn't fail the lookup
      }
    }
  }

  const result: ExtractionResult = base ?? {
    photo_url: null,
    msrp: null,
    size_chart: null,
    source_url: null,
  }

  // Size recommendation is live (never cached) — it depends on this user's
  // body_profile, which the cached result_json knows nothing about.
  let recommended_size: string | null = null
  let recommended_size_rationale: string | null = null
  if (result.size_chart) {
    try {
      const { data: profile } = await supabase
        .from('body_profile')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()
      if (profile) {
        const rec = await recommendSize(result.size_chart, profile)
        if (rec) {
          recommended_size = rec.recommended_size
          recommended_size_rationale = rec.rationale
        }
      }
    } catch {
      // no recommendation on failure; result itself still returns
    }
  }

  return NextResponse.json({ ...result, recommended_size, recommended_size_rationale })
}
