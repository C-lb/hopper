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
