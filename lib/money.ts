export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

export function formatMoney(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount)
}

export const computeSavings = (msrp: number, price: number) => Math.max(0, round2(msrp - price))
