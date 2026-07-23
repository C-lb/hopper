import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const date = searchParams.get('date')
  if (!from || !to || !date) {
    return NextResponse.json({ error: 'from, to and date are required' }, { status: 400 })
  }
  const r = await fetch(
    `https://api.frankfurter.app/${encodeURIComponent(date)}?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
  )
  if (!r.ok) return NextResponse.json({ error: 'fx upstream failed' }, { status: 502 })
  const j = await r.json()
  return NextResponse.json({ rate: j.rates[to], date: j.date })
}
