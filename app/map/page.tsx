'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { createBrowserSupabase } from '@/lib/supabase/client'
import type { Purchase } from '@/lib/types'

// Leaflet touches `window` at import time, so the map itself must never be
// rendered during SSR — load it client-only.
const MapView = dynamic(() => import('@/components/MapView').then(m => m.MapView), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full animate-pulse items-center justify-center bg-surface">
      <p className="text-[13px] text-foreground/50">Loading map…</p>
    </div>
  ),
})

export default function MapPage() {
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)

      const supabase = createBrowserSupabase()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        if (!cancelled) {
          setError('You must be signed in to view your map.')
          setLoading(false)
        }
        return
      }

      const { data, error: fetchError } = await supabase
        .from('purchases')
        .select('*')
        .eq('user_id', user.id)
        .not('location_lat', 'is', null)
        .not('location_lng', 'is', null)

      if (cancelled) return

      if (fetchError) {
        setError(fetchError.message)
        setLoading(false)
        return
      }

      setPurchases((data ?? []) as Purchase[])
      setLoading(false)
    }

    load()

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="flex h-full min-h-[calc(100vh-4rem)] flex-col lg:min-h-screen">
      <div className="px-4 pb-4 pt-8 lg:px-8 lg:pt-10">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Map</h1>
      </div>

      {loading && (
        <div className="mx-4 mb-8 flex-1 animate-pulse rounded-[14px] bg-surface lg:mx-8" style={{ minHeight: 420 }} />
      )}

      {!loading && error && (
        <p role="alert" className="mx-4 text-sm text-danger lg:mx-8">
          {error}
        </p>
      )}

      {!loading && !error && purchases.length === 0 && (
        <div className="mx-4 mb-8 flex flex-1 flex-col items-center justify-center gap-3 rounded-[14px] bg-surface px-6 py-16 text-center lg:mx-8" style={{ minHeight: 420 }}>
          <p className="text-[15px] font-medium text-foreground">No purchases with a location yet</p>
          <p className="max-w-sm text-[13px] text-foreground/60 max-[640px]:text-[14px]">
            Add a location when you log a purchase to see it show up here.
          </p>
          <Link
            href="/purchases/new"
            className="hoppable hoppable-strong mt-1 rounded-[10px] px-5 py-2.5 text-[13px] font-medium"
          >
            Add a purchase
          </Link>
        </div>
      )}

      {!loading && !error && purchases.length > 0 && (
        <div className="mx-4 mb-8 flex-1 overflow-hidden rounded-[14px] lg:mx-8" style={{ minHeight: 420 }}>
          <MapView purchases={purchases} />
        </div>
      )}
    </div>
  )
}
