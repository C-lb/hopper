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
