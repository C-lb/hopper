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
