'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserSupabase } from '@/lib/supabase/client'
import { CurrencyField, type CurrencyFieldValue } from '@/components/CurrencyField'
import { LocationField } from '@/components/LocationField'
import { CURRENCIES } from '@/lib/currencies'
import { fetchRate, convert } from '@/lib/fx'
import { computeSavings } from '@/lib/money'
import type { Purchase, Condition } from '@/lib/types'

const CATEGORIES = ['clothing', 'shoes', 'electronics', 'homeware', 'other'] as const
const CONDITIONS: Condition[] = ['new', 'like-new', 'used', 'refurbished']
const SIZED_CATEGORIES = new Set(['clothing', 'shoes'])

type LocationValue = { name: string; lat: number | null; lng: number | null }

type Props = {
  mode: 'create' | 'edit'
  purchaseId?: string
  initial?: Purchase
}

/** Local datetime string (YYYY-MM-DDTHH:mm) for a Date, in the browser's local time. */
function toDatetimeLocal(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

const inputClass =
  'w-full rounded-[10px] border border-black/10 bg-background px-4 py-2.5 text-[13px] text-foreground outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 max-[640px]:text-[17px]'
const selectClass = inputClass + ' appearance-none'
const labelClass = 'mb-1.5 block text-[13px] text-foreground/70 max-[640px]:text-[15px]'

export function PurchaseForm({ mode, purchaseId, initial }: Props) {
  const router = useRouter()
  const defaultCurrency = CURRENCIES[0]?.code ?? 'SGD'

  const [itemName, setItemName] = useState(initial?.item_name ?? '')
  const [brand, setBrand] = useState(initial?.brand ?? '')
  const [category, setCategory] = useState(initial?.category ?? CATEGORIES[0])
  const [condition, setCondition] = useState<Condition>(initial?.condition ?? 'new')
  const [size, setSize] = useState(initial?.size ?? '')
  const [purchasedAt, setPurchasedAt] = useState(
    initial?.purchased_at ? toDatetimeLocal(new Date(initial.purchased_at)) : toDatetimeLocal(new Date())
  )
  const [currency, setCurrency] = useState<CurrencyFieldValue>({
    price_amount: initial?.price_amount ?? 0,
    price_currency: initial?.price_currency ?? defaultCurrency,
    display_currency: initial?.display_currency ?? initial?.price_currency ?? defaultCurrency,
    fx_rate: initial?.fx_rate ?? null,
    fx_rate_date: initial?.fx_rate_date ?? null,
    converted_amount: initial?.converted_amount ?? null,
  })
  const [location, setLocation] = useState<LocationValue>({
    name: initial?.location_name ?? '',
    lat: initial?.location_lat ?? null,
    lng: initial?.location_lng ?? null,
  })
  const [msrpAmount, setMsrpAmount] = useState(initial?.msrp_amount != null ? String(initial.msrp_amount) : '')
  const [msrpCurrency, setMsrpCurrency] = useState(initial?.msrp_currency ?? currency.price_currency)
  const [photoUrl, setPhotoUrl] = useState(initial?.photo_url ?? '')
  const [sourceUrl, setSourceUrl] = useState(initial?.source_url ?? '')
  const [notes, setNotes] = useState(initial?.notes ?? '')

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [lookingUp, setLookingUp] = useState(false)
  const [lookupNote, setLookupNote] = useState<string | null>(null)
  const [recommendation, setRecommendation] = useState<{ size: string; why: string | null } | null>(null)

  const showSize = SIZED_CATEGORIES.has(category ?? '')

  async function handleLookup() {
    setLookingUp(true)
    setLookupNote(null)
    try {
      const r = await fetch('/api/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_name: itemName, brand }),
      })
      const d = await r.json()

      if (d.photo_url != null) setPhotoUrl(d.photo_url)
      if (d.msrp?.amount != null) setMsrpAmount(String(d.msrp.amount))
      if (d.msrp?.currency != null) setMsrpCurrency(d.msrp.currency)
      if (d.source_url != null) setSourceUrl(d.source_url)

      setRecommendation(
        d.recommended_size ? { size: d.recommended_size, why: d.recommended_size_rationale ?? null } : null
      )

      if (!d.photo_url && !d.msrp && !d.size_chart) {
        setLookupNote("Couldn't find details, enter manually")
      }
    } catch {
      setLookupNote("Couldn't find details, enter manually")
    } finally {
      setLookingUp(false)
    }
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    if (!itemName.trim()) {
      setError('Item name is required.')
      return
    }

    setSaving(true)

    const supabase = createBrowserSupabase()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setError('You must be signed in to save a purchase.')
      setSaving(false)
      return
    }

    // Compute savings against MSRP, converted into the display currency.
    // FX failure here must not block the save — savings just end up unset.
    let savingsAmount: number | null = null
    let savingsCurrency: string | null = null

    const msrpParsed = msrpAmount.trim() === '' ? null : parseFloat(msrpAmount)
    if (msrpParsed != null && Number.isFinite(msrpParsed)) {
      try {
        const displayCcy = currency.display_currency
        const msrpCcy = msrpCurrency || currency.price_currency
        const fxDate = purchasedAt.slice(0, 10)

        let msrpInDisplay = msrpParsed
        if (msrpCcy !== displayCcy) {
          const { rate } = await fetchRate(msrpCcy, displayCcy, fxDate)
          msrpInDisplay = convert(msrpParsed, rate)
        }

        const priceInDisplay = currency.converted_amount ?? currency.price_amount

        savingsAmount = computeSavings(msrpInDisplay, priceInDisplay)
        savingsCurrency = displayCcy ?? currency.price_currency
      } catch {
        savingsAmount = null
        savingsCurrency = null
      }
    }

    const row = {
      user_id: user.id,
      item_name: itemName.trim(),
      brand: brand.trim() || null,
      category: category || null,
      condition,
      size: showSize ? size.trim() || null : null,
      purchased_at: new Date(purchasedAt).toISOString(),
      price_amount: currency.price_amount,
      price_currency: currency.price_currency,
      display_currency: currency.display_currency,
      fx_rate: currency.fx_rate,
      fx_rate_date: currency.fx_rate_date,
      converted_amount: currency.converted_amount,
      location_name: location.name.trim() || null,
      location_lat: location.lat,
      location_lng: location.lng,
      photo_url: photoUrl.trim() || null,
      msrp_amount: msrpParsed,
      msrp_currency: msrpParsed != null ? msrpCurrency || currency.price_currency : null,
      savings_amount: savingsAmount,
      savings_currency: savingsCurrency,
      source_url: sourceUrl.trim() || null,
      notes: notes.trim() || null,
    }

    const { error: saveError } =
      mode === 'edit' && purchaseId
        ? await supabase.from('purchases').update(row).eq('id', purchaseId)
        : await supabase.from('purchases').insert(row)

    setSaving(false)

    if (saveError) {
      setError(saveError.message)
      return
    }

    router.push('/catalogue')
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <div className="rounded-[20px] bg-surface p-6 shadow-[0_14px_34px_-18px_rgba(0,0,0,.35)]">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="sm:col-span-2">
            <span className={labelClass}>Item name</span>
            <input
              type="text"
              required
              value={itemName}
              onChange={e => setItemName(e.target.value)}
              placeholder="e.g. Air Force 1"
              className={inputClass}
            />
          </label>

          <label>
            <span className={labelClass}>Brand</span>
            <input
              type="text"
              value={brand}
              onChange={e => setBrand(e.target.value)}
              placeholder="e.g. Nike"
              className={inputClass}
            />
          </label>

          <label>
            <span className={labelClass}>Category</span>
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              className={selectClass}
            >
              {CATEGORIES.map(c => (
                <option key={c} value={c}>
                  {c[0].toUpperCase() + c.slice(1)}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span className={labelClass}>Condition</span>
            <select
              value={condition}
              onChange={e => setCondition(e.target.value as Condition)}
              className={selectClass}
            >
              {CONDITIONS.map(c => (
                <option key={c} value={c}>
                  {c[0].toUpperCase() + c.slice(1)}
                </option>
              ))}
            </select>
          </label>

          {showSize && (
            <label>
              <span className={labelClass}>Size</span>
              <input
                type="text"
                value={size}
                onChange={e => setSize(e.target.value)}
                placeholder="e.g. US 9"
                className={inputClass}
              />
              {recommendation && (
                <div className="mt-2 rounded-[10px] border border-black/10 bg-background px-3 py-2.5 dark:border-white/10">
                  <p className="text-[13px] text-foreground max-[640px]:text-[15px]">
                    Recommended size: <span className="font-medium">{recommendation.size}</span>
                  </p>
                  {recommendation.why && (
                    <p className="mt-0.5 text-[12px] text-foreground/60 max-[640px]:text-[14px]">
                      {recommendation.why}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => setSize(recommendation.size)}
                    className="mt-1.5 text-[12px] font-medium text-accent underline-offset-2 hover:underline max-[640px]:text-[14px]"
                  >
                    Use this
                  </button>
                </div>
              )}
            </label>
          )}

          <label>
            <span className={labelClass}>Purchased at</span>
            <input
              type="datetime-local"
              required
              value={purchasedAt}
              onChange={e => setPurchasedAt(e.target.value)}
              className={inputClass}
            />
          </label>
        </div>
      </div>

      <div className="rounded-[20px] bg-surface p-6 shadow-[0_14px_34px_-18px_rgba(0,0,0,.35)]">
        <h2 className="mb-4 text-[13px] font-medium text-foreground/70 max-[640px]:text-[15px]">
          Price
        </h2>
        <CurrencyField value={currency} onChange={setCurrency} purchasedAt={purchasedAt} />

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label>
            <span className={labelClass}>MSRP amount</span>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={msrpAmount}
              onChange={e => setMsrpAmount(e.target.value)}
              placeholder="Optional"
              className={inputClass}
            />
          </label>

          <label>
            <span className={labelClass}>MSRP currency</span>
            <select
              value={msrpCurrency}
              onChange={e => setMsrpCurrency(e.target.value)}
              className={selectClass}
            >
              {CURRENCIES.map(c => (
                <option key={c.code} value={c.code}>
                  {c.code} · {c.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="rounded-[20px] bg-surface p-6 shadow-[0_14px_34px_-18px_rgba(0,0,0,.35)]">
        <h2 className="mb-4 text-[13px] font-medium text-foreground/70 max-[640px]:text-[15px]">
          Location
        </h2>
        <LocationField
          value={location.name}
          onChange={place => setLocation(place)}
          placeholder="Where did you buy it?"
        />
      </div>

      <div className="rounded-[20px] bg-surface p-6 shadow-[0_14px_34px_-18px_rgba(0,0,0,.35)]">
        <div className="grid grid-cols-1 gap-4">
          <div className="flex items-end gap-3">
            <label className="flex-1">
              <span className={labelClass}>Photo URL</span>
              <input
                type="url"
                value={photoUrl}
                onChange={e => setPhotoUrl(e.target.value)}
                placeholder="https://..."
                className={inputClass}
              />
            </label>

            <button
              type="button"
              onClick={handleLookup}
              disabled={!itemName.trim() || lookingUp}
              title="Look up photo, MSRP and size from the web"
              className="mb-[1px] flex shrink-0 items-center gap-2 rounded-[10px] border border-black/10 bg-background px-5 py-2.5 text-[13px] font-medium text-foreground/70 transition-colors hover:bg-surface focus-visible:ring-2 focus-visible:ring-accent/30 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 max-[640px]:text-[15px]"
            >
              {lookingUp && (
                <svg
                  className="h-3.5 w-3.5 animate-spin text-foreground/50"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
              )}
              {lookingUp ? 'Looking up...' : 'Look up'}
            </button>
          </div>

          {lookupNote && (
            <p className="-mt-2 text-[12px] text-warn max-[640px]:text-[14px]">{lookupNote}</p>
          )}

          <label>
            <span className={labelClass}>Notes</span>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              placeholder="Anything else worth remembering"
              className={`${inputClass} resize-none`}
            />
          </label>
        </div>
      </div>

      {error && (
        <p role="alert" className="text-[13px] text-danger max-[640px]:text-[15px]">
          {error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded-[10px] bg-accent px-6 py-3 text-[13px] font-medium text-accent-foreground transition-opacity hover:opacity-90 active:opacity-80 focus-visible:ring-2 focus-visible:ring-accent/40 disabled:cursor-not-allowed disabled:opacity-50 max-[640px]:text-[15px]"
        >
          {saving ? 'Saving...' : mode === 'edit' ? 'Save changes' : 'Add purchase'}
        </button>
      </div>
    </form>
  )
}
