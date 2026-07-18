'use client'

import { use, useEffect, useState } from 'react'
import { createBrowserSupabase } from '@/lib/supabase/client'
import { PurchaseForm } from '@/components/PurchaseForm'
import type { Purchase } from '@/lib/types'

type Props = {
  params: Promise<{ id: string }>
}

export default function EditPurchasePage({ params }: Props) {
  const { id } = use(params)

  const [purchase, setPurchase] = useState<Purchase | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)

      const supabase = createBrowserSupabase()
      const { data, error: fetchError } = await supabase
        .from('purchases')
        .select('*')
        .eq('id', id)
        .maybeSingle()

      if (cancelled) return

      if (fetchError) {
        setError(fetchError.message)
        setLoading(false)
        return
      }

      if (!data) {
        setError('Purchase not found.')
        setLoading(false)
        return
      }

      setPurchase(data as Purchase)
      setLoading(false)
    }

    load()

    return () => {
      cancelled = true
    }
  }, [id])

  return (
    <div className="mx-auto max-w-xl px-4 py-10 lg:px-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Edit purchase</h1>
        <p className="mt-2 text-sm text-foreground/60">Update the details of this purchase.</p>
      </div>

      {loading && <p className="text-sm text-foreground/60">Loading...</p>}

      {!loading && error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}

      {!loading && !error && purchase && (
        <PurchaseForm mode="edit" purchaseId={purchase.id} initial={purchase} />
      )}
    </div>
  )
}
