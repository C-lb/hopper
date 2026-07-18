import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')!
  const to = searchParams.get('to')!
  const date = searchParams.get('date')!
  const r = await fetch(`https://api.frankfurter.app/${date}?from=${from}&to=${to}`)
  if (!r.ok) return NextResponse.json({ error: 'fx upstream failed' }, { status: 502 })
  const j = await r.json()
  return NextResponse.json({ rate: j.rates[to], date: j.date })
}
