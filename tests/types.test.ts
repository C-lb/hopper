import { describe, it, expect } from 'vitest'
import type { BodyProfile, Purchase, Condition } from '@/lib/types'
import { CURRENCIES } from '@/lib/currencies'

describe('types and currencies', () => {
  it('CURRENCIES has expected length and includes SGD', () => {
    expect(CURRENCIES.length).toBeGreaterThan(0)
    expect(CURRENCIES.some(c => c.code === 'SGD')).toBe(true)
  })

  it('type imports compile without error', () => {
    // compile-only check: if types import successfully, this passes
    const condition: Condition = 'new'
    expect(condition).toBe('new')
  })
})
