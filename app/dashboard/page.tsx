'use client'

import { useEffect, useMemo, useState } from 'react'
import { createBrowserSupabase } from '@/lib/supabase/client'
import { Stat } from '@/components/Stat'
import { CURRENCIES } from '@/lib/currencies'
import { formatMoney } from '@/lib/money'
import type { Purchase, Condition } from '@/lib/types'

const HOME_DEFAULT = 'SGD'

const CONDITION_LABEL: Record<Condition, string> = {
  new: 'New',
  defective: 'Defective',
  refurbished: 'Refurbished',
  A: 'Grade A',
  B: 'Grade B',
  C: 'Grade C',
  D: 'Grade D',
}

const inputClass =
  'rounded-[10px] border border-black/10 bg-background px-3.5 py-2 text-[13px] text-foreground outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 dark:border-white/10 max-[640px]:text-[15px]'

type Bar = { label: string; value: number }

/** Single-axis horizontal bar chart: visible value axis, few bars, one accent highlight. */
function BarChart({ bars, formatValue }: { bars: Bar[]; formatValue: (n: number) => string }) {
  const max = Math.max(1, ...bars.map(b => b.value))
  const topIndex = bars.reduce((best, b, i) => (b.value > (bars[best]?.value ?? -Infinity) ? i : best), 0)

  if (bars.length === 0) {
    return <p className="text-[13px] text-foreground/50">Nothing to show yet.</p>
  }

  return (
    <div className="flex flex-col gap-3">
      {bars.map((b, i) => (
        <div key={b.label} className="flex items-center gap-3">
          <span className="w-24 shrink-0 truncate text-[13px] text-foreground/70 max-[640px]:text-[14px]">
            {b.label}
          </span>
          <div className="relative h-6 flex-1 rounded-[6px] bg-black/5 dark:bg-white/5">
            <div
              className={`h-full rounded-[6px] ${i === topIndex ? 'bg-accent' : 'bg-foreground/25'}`}
              style={{ width: `${Math.max(4, (b.value / max) * 100)}%` }}
            />
          </div>
          <span className="w-20 shrink-0 text-right text-[13px] tabular-nums text-foreground/70 max-[640px]:text-[14px]">
            {formatValue(b.value)}
          </span>
        </div>
      ))}
      <div className="ml-24 flex justify-between border-t border-black/10 pt-1.5 text-[11px] text-foreground/40 dark:border-white/10">
        <span>0</span>
        <span>{formatValue(max)}</span>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [homeCurrency, setHomeCurrency] = useState(HOME_DEFAULT)

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
          setError('You must be signed in to view your dashboard.')
          setLoading(false)
        }
        return
      }

      const { data, error: fetchError } = await supabase
        .from('purchases')
        .select('*')
        .eq('user_id', user.id)
        .order('purchased_at', { ascending: false })

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

  const stats = useMemo(() => {
    let totalSpend = 0
    let spendRows = 0
    let excludedRows = 0
    let totalSaved = 0

    for (const p of purchases) {
      // Only sum a row into the home-currency total when its value is
      // ALREADY denominated in the home currency: either it was paid in the
      // home currency, or it was explicitly converted to it. Never convert
      // on read — that would fabricate a number the user didn't see.
      if (p.price_currency === homeCurrency) {
        totalSpend += p.price_amount
        spendRows += 1
      } else if (p.display_currency === homeCurrency && p.converted_amount != null) {
        totalSpend += p.converted_amount
        spendRows += 1
      } else {
        excludedRows += 1
      }

      if (p.savings_amount != null && p.savings_amount > 0 && p.savings_currency === homeCurrency) {
        totalSaved += p.savings_amount
      }
    }

    return { totalSpend, spendRows, excludedRows, totalSaved, itemCount: purchases.length }
  }, [purchases, homeCurrency])

  const categoryBars = useMemo(() => {
    const totals = new Map<string, number>()
    for (const p of purchases) {
      const value =
        p.price_currency === homeCurrency
          ? p.price_amount
          : p.display_currency === homeCurrency && p.converted_amount != null
            ? p.converted_amount
            : null
      if (value == null) continue
      const key = p.category || 'Uncategorised'
      totals.set(key, (totals.get(key) ?? 0) + value)
    }
    return Array.from(totals.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8)
  }, [purchases, homeCurrency])

  const conditionBars = useMemo(() => {
    const totals = new Map<Condition, number>()
    for (const p of purchases) totals.set(p.condition, (totals.get(p.condition) ?? 0) + 1)
    return (['new', 'like-new', 'used', 'refurbished'] as Condition[])
      .filter(c => totals.has(c))
      .map(c => ({ label: CONDITION_LABEL[c], value: totals.get(c) ?? 0 }))
  }, [purchases])

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 lg:px-8 lg:py-10">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Dashboard</h1>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="home-currency" className="text-[13px] text-foreground/60 max-[640px]:text-[14px]">
            Home currency
          </label>
          <select
            id="home-currency"
            value={homeCurrency}
            onChange={e => setHomeCurrency(e.target.value)}
            className={`${inputClass} appearance-none`}
          >
            {CURRENCIES.map(c => (
              <option key={c.code} value={c.code}>
                {c.code}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading && (
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-[14px] bg-surface" />
          ))}
        </div>
      )}

      {!loading && error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}

      {!loading && !error && purchases.length === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-[14px] bg-surface px-6 py-16 text-center">
          <p className="text-[15px] font-medium text-foreground">Nothing to summarise yet</p>
          <p className="text-[13px] text-foreground/60 max-[640px]:text-[14px]">
            Add a few purchases and your dashboard will fill in.
          </p>
        </div>
      )}

      {!loading && !error && purchases.length > 0 && (
        <>
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
            <Stat label="Items logged" value={stats.itemCount} />
            <Stat
              label={`Total spend (${homeCurrency})`}
              value={formatMoney(stats.totalSpend, homeCurrency)}
              hint={
                stats.excludedRows > 0
                  ? `${stats.excludedRows} purchase${stats.excludedRows === 1 ? '' : 's'} in other currencies excluded`
                  : undefined
              }
            />
            <Stat label={`Total saved (${homeCurrency})`} value={formatMoney(stats.totalSaved, homeCurrency)} />
          </div>

          <div className="mt-6 grid grid-cols-1 gap-3.5 lg:grid-cols-2">
            <div className="rounded-[14px] bg-surface p-4">
              <p className="mb-4 text-[13px] font-medium text-foreground max-[640px]:text-[14px]">
                Spend by category ({homeCurrency})
              </p>
              <BarChart bars={categoryBars} formatValue={n => formatMoney(n, homeCurrency)} />
            </div>
            <div className="rounded-[14px] bg-surface p-4">
              <p className="mb-4 text-[13px] font-medium text-foreground max-[640px]:text-[14px]">
                Items by condition
              </p>
              <BarChart bars={conditionBars} formatValue={n => String(n)} />
            </div>
          </div>
        </>
      )}
    </div>
  )
}
