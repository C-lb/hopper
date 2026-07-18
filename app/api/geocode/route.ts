import { NextRequest, NextResponse } from 'next/server'
import { parseNominatim } from '@/lib/geocode'

export async function GET(req: NextRequest) {
  const q = new URL(req.url).searchParams.get('q') ?? ''
  try {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=6&q=${encodeURIComponent(q)}`,
      { headers: { 'User-Agent': 'Hopper/1.0 (purchase catalogue)' } }
    )
    if (!r.ok) return NextResponse.json([], { status: 200 })
    return NextResponse.json(parseNominatim(await r.json()))
  } catch {
    return NextResponse.json([], { status: 200 })
  }
}
