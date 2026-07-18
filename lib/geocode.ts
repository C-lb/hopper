export type NominatimRow = { display_name: string; lat: string; lon: string }
export type Place = { name: string; lat: number; lng: number }

export function parseNominatim(rows: NominatimRow[]): Place[] {
  return rows.map(r => ({ name: r.display_name, lat: parseFloat(r.lat), lng: parseFloat(r.lon) }))
}

export async function searchPlaces(q: string): Promise<Place[]> {
  if (q.trim().length < 3) return []
  try {
    const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`)
    if (!res.ok) return []
    return await res.json()
  } catch {
    return []
  }
}
