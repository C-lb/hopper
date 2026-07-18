'use client'

import { useEffect, useMemo, useState, type SVGProps } from 'react'
import Link from 'next/link'
import { createBrowserSupabase } from '@/lib/supabase/client'
import { PurchaseCard } from '@/components/PurchaseCard'
import type { Purchase, Condition } from '@/lib/types'

const CONDITIONS: Condition[] = ['new', 'like-new', 'used', 'refurbished']

type IconProps = SVGProps<SVGSVGElement>

function iconProps(props: IconProps): IconProps {
  return {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    ...props,
  }
}

function IconGrid(props: IconProps) {
  return (
    <svg {...iconProps(props)}>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  )
}

function IconList(props: IconProps) {
  return (
    <svg {...iconProps(props)}>
      <path d="M8 6h13M8 12h13M8 18h13" />
      <path d="M3 6h.01M3 12h.01M3 18h.01" />
    </svg>
  )
}

const inputClass =
  'w-full rounded-[10px] border border-black/10 bg-background px-3.5 py-2 text-[13px] text-foreground outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 dark:border-white/10 max-[640px]:text-[15px]'
const selectClass = inputClass + ' appearance-none'

function CardSkeleton() {
  return (
    <div className="animate-pulse overflow-hidden rounded-[14px] bg-surface">
      <div className="aspect-square w-full bg-black/5 dark:bg-white/5" />
      <div className="space-y-2 p-3.5">
        <div className="h-3 w-3/4 rounded bg-black/5 dark:bg-white/5" />
        <div className="h-3 w-1/2 rounded bg-black/5 dark:bg-white/5" />
      </div>
    </div>
  )
}

export default function CataloguePage() {
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [condition, setCondition] = useState('')
  const [currency, setCurrency] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

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
          setError('You must be signed in to view your catalogue.')
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

  const categories = useMemo(() => {
    const set = new Set<string>()
    for (const p of purchases) if (p.category) set.add(p.category)
    return Array.from(set).sort()
  }, [purchases])

  const currencies = useMemo(() => {
    const set = new Set<string>()
    for (const p of purchases) set.add(p.price_currency)
    return Array.from(set).sort()
  }, [purchases])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return purchases.filter(p => {
      if (term) {
        const haystack = `${p.item_name} ${p.brand ?? ''}`.toLowerCase()
        if (!haystack.includes(term)) return false
      }
      if (category && p.category !== category) return false
      if (condition && p.condition !== condition) return false
      if (currency && p.price_currency !== currency) return false
      if (dateFrom && p.purchased_at < dateFrom) return false
      if (dateTo && p.purchased_at > `${dateTo}T23:59:59`) return false
      return true
    })
  }, [purchases, search, category, condition, currency, dateFrom, dateTo])

  const hasAny = purchases.length > 0
  const hasFilters = Boolean(search || category || condition || currency || dateFrom || dateTo)

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 lg:px-8 lg:py-10">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Catalogue</h1>
          <p className="mt-1.5 text-[13px] text-foreground/60 max-[640px]:text-[14px]">
            Everything you have logged, newest first.
          </p>
        </div>
        <Link
          href="/purchases/new"
          className="rounded-[10px] bg-accent px-5 py-2.5 text-[13px] font-medium text-accent-foreground transition-opacity hover:opacity-90 active:opacity-80 max-[640px]:text-[15px]"
        >
          Add a purchase
        </Link>
      </div>

      {hasAny && (
        <div className="mb-6 flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
            <input
              type="search"
              placeholder="Search item or brand"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className={`${inputClass} col-span-2 lg:col-span-2`}
            />
            <select value={category} onChange={e => setCategory(e.target.value)} className={selectClass}>
              <option value="">All categories</option>
              {categories.map(c => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <select value={condition} onChange={e => setCondition(e.target.value)} className={selectClass}>
              <option value="">All conditions</option>
              {CONDITIONS.map(c => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <select value={currency} onChange={e => setCurrency(e.target.value)} className={selectClass}>
              <option value="">All currencies</option>
              {currencies.map(c => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <div className="col-span-2 flex items-center gap-1.5 sm:col-span-1 lg:col-span-1">
              <input
                type="date"
                aria-label="From date"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <input
              type="date"
              aria-label="To date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className={`${inputClass} w-auto`}
            />
            <div className="flex items-center gap-1 rounded-[10px] bg-surface p-1">
              <button
                type="button"
                aria-label="Grid view"
                aria-pressed={view === 'grid'}
                onClick={() => setView('grid')}
                className={`rounded-[8px] p-2 transition-colors ${
                  view === 'grid' ? 'bg-accent text-accent-foreground' : 'text-foreground/60 hover:text-foreground'
                }`}
              >
                <IconGrid className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label="List view"
                aria-pressed={view === 'list'}
                onClick={() => setView('list')}
                className={`rounded-[8px] p-2 transition-colors ${
                  view === 'list' ? 'bg-accent text-accent-foreground' : 'text-foreground/60 hover:text-foreground'
                }`}
              >
                <IconList className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {loading && (
        <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      )}

      {!loading && error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}

      {!loading && !error && !hasAny && (
        <div className="flex flex-col items-center gap-3 rounded-[14px] bg-surface px-6 py-16 text-center">
          <p className="text-[15px] font-medium text-foreground">No purchases yet</p>
          <p className="max-w-sm text-[13px] text-foreground/60 max-[640px]:text-[14px]">
            Log what you buy to build out your catalogue, see it on the map, and track how much you have saved.
          </p>
          <Link
            href="/purchases/new"
            className="mt-1 rounded-[10px] bg-accent px-5 py-2.5 text-[13px] font-medium text-accent-foreground transition-opacity hover:opacity-90 active:opacity-80"
          >
            Add your first purchase
          </Link>
        </div>
      )}

      {!loading && !error && hasAny && filtered.length === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-[14px] bg-surface px-6 py-16 text-center">
          <p className="text-[15px] font-medium text-foreground">No purchases match these filters</p>
          <p className="text-[13px] text-foreground/60 max-[640px]:text-[14px]">
            {hasFilters ? 'Try widening your search or clearing a filter.' : 'Try a different search.'}
          </p>
        </div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <div
          className={
            view === 'grid'
              ? 'grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-4'
              : 'flex flex-col gap-2.5'
          }
        >
          {filtered.map(p => (
            <PurchaseCard key={p.id} purchase={p} view={view} />
          ))}
        </div>
      )}
    </div>
  )
}
