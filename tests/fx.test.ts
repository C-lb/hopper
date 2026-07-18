import { expect, test, vi } from 'vitest'
import { convert, fetchRate } from '@/lib/fx'

test('convert rounds to 2dp', () => {
  expect(convert(10, 1.345)).toBe(13.45)
})

test('same currency short-circuits', async () => {
  const r = await fetchRate('USD', 'USD', '2026-07-01')
  expect(r.rate).toBe(1)
})

test('fetchRate parses /api/fx response shape', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, json: async () => ({ rate: 1.34, date: '2026-07-01' }) }))
  )
  const r = await fetchRate('USD', 'SGD', '2026-07-01')
  expect(r.rate).toBe(1.34)
  expect(r.date).toBe('2026-07-01')
})
