import { expect, test } from 'vitest'
import { rankResults } from '@/lib/enrichment/ranking'
test('brand official ranks above amazon above random', () => {
  const r = rankResults([
    { url: 'https://random.blog/x', content: 'a' },
    { url: 'https://www.amazon.com/dp/1', content: 'b' },
    { url: 'https://nike.com/t/shoe', content: 'c' },
  ], 'Nike')
  expect(r.map(x => new URL(x.url).host)).toEqual(['nike.com', 'www.amazon.com', 'random.blog'])
})
