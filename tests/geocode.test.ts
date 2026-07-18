import { expect, test, vi, afterEach } from 'vitest'
import { parseNominatim, searchPlaces } from '@/lib/geocode'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

test('parse nominatim rows', () => {
  const rows = [{ display_name: 'Uniqlo, Orchard', lat: '1.30', lon: '103.83' }]
  expect(parseNominatim(rows)).toEqual([{ name: 'Uniqlo, Orchard', lat: 1.3, lng: 103.83 }])
})

test('parse nominatim empty rows', () => {
  expect(parseNominatim([])).toEqual([])
})

test('searchPlaces returns [] for queries under 3 chars', async () => {
  const fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
  expect(await searchPlaces('ab')).toEqual([])
  expect(await searchPlaces('  ')).toEqual([])
  expect(fetchMock).not.toHaveBeenCalled()
})

test('searchPlaces calls /api/geocode and returns results', async () => {
  const results = [{ name: 'Uniqlo, Orchard', lat: 1.3, lng: 103.83 }]
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => results })
  vi.stubGlobal('fetch', fetchMock)
  expect(await searchPlaces('orchard')).toEqual(results)
  expect(fetchMock).toHaveBeenCalledWith('/api/geocode?q=orchard')
})

test('searchPlaces returns [] on upstream failure', async () => {
  const fetchMock = vi.fn().mockResolvedValue({ ok: false })
  vi.stubGlobal('fetch', fetchMock)
  expect(await searchPlaces('orchard')).toEqual([])
})

test('searchPlaces returns [] when fetch throws', async () => {
  const fetchMock = vi.fn().mockRejectedValue(new Error('network down'))
  vi.stubGlobal('fetch', fetchMock)
  expect(await searchPlaces('orchard')).toEqual([])
})
