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
