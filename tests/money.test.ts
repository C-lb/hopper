import { expect, test } from 'vitest'
import { round2, formatMoney, computeSavings } from '@/lib/money'

test('round2 avoids float drift', () => { expect(round2(0.1 + 0.2)).toBe(0.3) })
test('formatMoney 2dp', () => { expect(formatMoney(12.5, 'USD')).toBe('$12.50') })
test('formatMoney JPY 0dp', () => { expect(formatMoney(1200, 'JPY')).toBe('¥1,200') })
test('savings positive', () => { expect(computeSavings(100, 60)).toBe(40) })
test('savings clamps at 0', () => { expect(computeSavings(50, 80)).toBe(0) })
