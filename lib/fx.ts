import { round2 } from './money'

export const convert = (amount: number, rate: number) => round2(amount * rate)

export async function fetchRate(from: string, to: string, date: string) {
  if (from === to) return { rate: 1, date }
  const res = await fetch(`/api/fx?from=${from}&to=${to}&date=${date}`)
  if (!res.ok) throw new Error('fx failed')
  const j = await res.json()
  return { rate: j.rate as number, date: j.date as string }
}
