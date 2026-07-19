// Client-side historical FX helper. Hits the /api/fx Frankfurter proxy and
// caches every (date, from, to) rate in memory so a catalogue full of cards
// sharing the same currency pair + date only fetches once.

const cache = new Map<string, number | null>()
const inflight = new Map<string, Promise<number | null>>()

export async function getRate(from: string, to: string, date: string): Promise<number | null> {
  if (from === to) return 1
  const day = date.slice(0, 10)
  const key = `${day}|${from}|${to}`

  if (cache.has(key)) return cache.get(key) ?? null
  const pending = inflight.get(key)
  if (pending) return pending

  const promise = (async () => {
    try {
      const r = await fetch(`/api/fx?from=${from}&to=${to}&date=${day}`)
      if (!r.ok) {
        cache.set(key, null)
        return null
      }
      const j = await r.json()
      const rate = typeof j.rate === 'number' ? j.rate : null
      cache.set(key, rate)
      return rate
    } catch {
      cache.set(key, null)
      return null
    } finally {
      inflight.delete(key)
    }
  })()

  inflight.set(key, promise)
  return promise
}
