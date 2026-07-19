'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserSupabase } from '@/lib/supabase/client'
import { CurrencyField, type CurrencyFieldValue } from '@/components/CurrencyField'
import { LocationField } from '@/components/LocationField'
import { CURRENCIES } from '@/lib/currencies'
import { fetchRate, convert } from '@/lib/fx'
import { computeSavings } from '@/lib/money'
import type { Purchase, Condition, Category } from '@/lib/types'

const CONDITIONS: { value: Condition; label: string }[] = [
  { value: 'new', label: 'New' },
  { value: 'defective', label: 'Defective' },
  { value: 'refurbished', label: 'Refurbished' },
  { value: 'A', label: 'Grade A' },
  { value: 'B', label: 'Grade B' },
  { value: 'C', label: 'Grade C' },
  { value: 'D', label: 'Grade D' },
]

type LocationValue = { name: string; lat: number | null; lng: number | null }

type Props = {
  mode: 'create' | 'edit'
  purchaseId?: string
  initial?: Purchase
}

const pad = (n: number) => String(n).padStart(2, '0')

/** dd/mm/yyyy for a Date, in the browser's local time. */
function toDateStr(date: Date): string {
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`
}

/** HH:mm for a Date, in the browser's local time. */
function toTimeStr(date: Date): string {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** Progressive dd/mm/yyyy mask over raw keystrokes. */
function maskDate(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 8)
  let out = d.slice(0, 2)
  if (d.length >= 3) out += '/' + d.slice(2, 4)
  if (d.length >= 5) out += '/' + d.slice(4, 8)
  return out
}

/** YYYY-MM-DD from a dd/mm/yyyy string, or null if incomplete. */
function isoDatePart(dateStr: string): string | null {
  const m = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!m) return null
  return `${m[3]}-${m[2]}-${m[1]}`
}

/** Local-time Date from dd/mm/yyyy + HH:mm, or null if invalid. */
function toDate(dateStr: string, timeStr: string): Date | null {
  const m = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!m) return null
  const [hh = '0', mi = '0'] = (timeStr || '').split(':')
  const dt = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]), Number(hh), Number(mi))
  return Number.isNaN(dt.getTime()) ? null : dt
}

const inputClass =
  'w-full rounded-[10px] border border-black/10 bg-background px-4 py-2.5 text-[13px] text-foreground outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 max-[640px]:text-[17px]'
const selectClass = inputClass + ' appearance-none'
const labelClass = 'mb-1.5 block text-[13px] text-foreground/70 max-[640px]:text-[15px]'
const cardClass = 'rounded-[20px] bg-surface p-6 shadow-[0_14px_34px_-18px_rgba(0,0,0,.55)]'

export function PurchaseForm({ mode, purchaseId, initial }: Props) {
  const router = useRouter()
  const defaultCurrency = CURRENCIES[0]?.code ?? 'SGD'
  const initialDate = initial?.purchased_at ? new Date(initial.purchased_at) : new Date()

  const [itemName, setItemName] = useState(initial?.item_name ?? '')
  const [brand, setBrand] = useState(initial?.brand ?? '')
  const [serialNumber, setSerialNumber] = useState(initial?.serial_number ?? '')
  const [category, setCategory] = useState(initial?.category ?? '')
  const [categories, setCategories] = useState<Pick<Category, 'id' | 'name'>[]>([])
  const [addingCategory, setAddingCategory] = useState(false)
  const [newCatName, setNewCatName] = useState('')
  const [condition, setCondition] = useState<Condition>(initial?.condition ?? 'new')
  const [size, setSize] = useState(initial?.size ?? '')
  const [dateStr, setDateStr] = useState(toDateStr(initialDate))
  const [timeStr, setTimeStr] = useState(toTimeStr(initialDate))
  const [currency, setCurrency] = useState<CurrencyFieldValue>({
    price_amount: initial?.price_amount ?? 0,
    price_currency: initial?.price_currency ?? defaultCurrency,
  })
  const [location, setLocation] = useState<LocationValue>({
    name: initial?.location_name ?? '',
    lat: initial?.location_lat ?? null,
    lng: initial?.location_lng ?? null,
  })
  const [retailAmount, setRetailAmount] = useState(
    initial?.msrp_amount != null ? String(initial.msrp_amount) : ''
  )
  const [shippingFee, setShippingFee] = useState(
    initial?.shipping_fee != null ? String(initial.shipping_fee) : ''
  )
  const [photoUrl, setPhotoUrl] = useState(initial?.photo_url ?? '')
  const [websiteUrl, setWebsiteUrl] = useState(initial?.website_url ?? '')
  const [sourceUrl, setSourceUrl] = useState(initial?.source_url ?? '')
  const [notes, setNotes] = useState(initial?.notes ?? '')

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [lookingUp, setLookingUp] = useState(false)
  const [lookupNote, setLookupNote] = useState<string | null>(null)
  const [recommendation, setRecommendation] = useState<{ size: string; why: string | null } | null>(null)

  // Load the user's categories.
  useEffect(() => {
    let active = true
    const supabase = createBrowserSupabase()
    supabase
      .from('categories')
      .select()
      .then(({ data }: { data: Pick<Category, 'id' | 'name'>[] | null }) => {
        if (active) setCategories(data ?? [])
      })
    return () => {
      active = false
    }
  }, [])

  // The current value plus any loaded names, so a legacy category still shows.
  const categoryOptions = Array.from(
    new Set([...(category ? [category] : []), ...categories.map(c => c.name)])
  )

  async function handleAddCategory() {
    const name = newCatName.trim()
    if (!name) return
    setError(null)
    const supabase = createBrowserSupabase()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setError('You must be signed in to add a category.')
      return
    }
    const { data, error: catError } = await supabase
      .from('categories')
      .insert({ user_id: user.id, name })
      .select()
      .maybeSingle()
    if (catError) {
      setError(catError.message)
      return
    }
    const row = (data as Pick<Category, 'id' | 'name'> | null) ?? { id: name, name }
    setCategories(prev =>
      prev.some(c => c.name === row.name) ? prev : [...prev, row]
    )
    setCategory(name)
    setNewCatName('')
    setAddingCategory(false)
  }

  async function handleLookup() {
    setLookingUp(true)
    setLookupNote(null)
    try {
      const fxDate = isoDatePart(dateStr)
      const r = await fetch('/api/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_name: itemName,
          brand,
          price_currency: currency.price_currency,
          purchased_at: fxDate,
        }),
      })
      const d = await r.json()

      if (d.photo_url != null) setPhotoUrl(d.photo_url)
      if (d.source_url != null) {
        setSourceUrl(d.source_url)
        if (!websiteUrl.trim()) setWebsiteUrl(d.source_url)
      }

      // Retail must land in the purchase currency: translate at purchase-date FX.
      if (d.msrp?.amount != null) {
        let amount = d.msrp.amount as number
        const msrpCcy = d.msrp.currency as string | undefined
        if (msrpCcy && msrpCcy !== currency.price_currency && fxDate) {
          try {
            const { rate } = await fetchRate(msrpCcy, currency.price_currency, fxDate)
            amount = convert(amount, rate)
          } catch {
            // FX unavailable: keep the raw figure rather than block the lookup.
          }
        }
        setRetailAmount(String(amount))
      }

      if (d.shipping_fee != null) setShippingFee(String(d.shipping_fee))

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

    const purchasedDate = toDate(dateStr, timeStr)
    if (!purchasedDate) {
      setError('Enter the purchase date as dd/mm/yyyy.')
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

    const retailParsed = retailAmount.trim() === '' ? null : parseFloat(retailAmount)
    const retail = retailParsed != null && Number.isFinite(retailParsed) ? retailParsed : null
    const shippingParsed = shippingFee.trim() === '' ? null : parseFloat(shippingFee)
    const shipping = shippingParsed != null && Number.isFinite(shippingParsed) ? shippingParsed : null

    // Retail and price now share the purchase currency, so savings is a plain
    // subtraction (kept for back-compat; the catalogue no longer shows it).
    const savingsAmount = retail != null ? computeSavings(retail, currency.price_amount) : null

    const row = {
      user_id: user.id,
      item_name: itemName.trim(),
      brand: brand.trim() || null,
      serial_number: serialNumber.trim() || null,
      category: category || null,
      condition,
      size: size.trim() || null,
      purchased_at: purchasedDate.toISOString(),
      price_amount: currency.price_amount,
      price_currency: currency.price_currency,
      display_currency: null,
      fx_rate: null,
      fx_rate_date: null,
      converted_amount: null,
      location_name: location.name.trim() || null,
      location_lat: location.lat,
      location_lng: location.lng,
      photo_url: photoUrl.trim() || null,
      website_url: websiteUrl.trim() || null,
      shipping_fee: shipping,
      msrp_amount: retail,
      msrp_currency: retail != null ? currency.price_currency : null,
      savings_amount: savingsAmount,
      savings_currency: retail != null ? currency.price_currency : null,
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
      <div className={cardClass}>
        <label className="block">
          <span className={labelClass}>Item name</span>
          <input
            type="text"
            required
            value={itemName}
            onChange={e => setItemName(e.target.value)}
            placeholder="e.g. Air Force 1"
            className="w-full rounded-[12px] border border-black/10 bg-background px-4 py-3 text-xl font-semibold tracking-tight text-foreground outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 dark:border-white/10"
          />
        </label>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
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
            <span className={labelClass}>Serial number</span>
            <input
              type="text"
              value={serialNumber}
              onChange={e => setSerialNumber(e.target.value)}
              placeholder="Optional"
              className={inputClass}
            />
          </label>

          <div>
            <span className={labelClass}>Category</span>
            {addingCategory ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  autoFocus
                  value={newCatName}
                  onChange={e => setNewCatName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleAddCategory()
                    }
                  }}
                  placeholder="New category name"
                  className={inputClass}
                />
                <button
                  type="button"
                  onClick={handleAddCategory}
                  className="hoppable shrink-0 rounded-[10px] px-4 py-2.5 text-[13px] font-medium max-[640px]:text-[15px]"
                >
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAddingCategory(false)
                    setNewCatName('')
                  }}
                  className="shrink-0 rounded-[10px] px-2 py-2.5 text-[13px] text-foreground/60 hover:text-foreground max-[640px]:text-[15px]"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <select
                value={category}
                onChange={e => {
                  if (e.target.value === '__new__') {
                    setAddingCategory(true)
                    return
                  }
                  setCategory(e.target.value)
                }}
                className={selectClass}
              >
                <option value="" disabled>
                  Select category
                </option>
                {categoryOptions.map(name => (
                  <option key={name} value={name}>
                    {name[0]?.toUpperCase() + name.slice(1)}
                  </option>
                ))}
                <option value="__new__">+ Add new category</option>
              </select>
            )}
            <a
              href="/categories"
              className="mt-1.5 inline-block text-[12px] text-foreground/60 underline-offset-2 hover:text-foreground hover:underline max-[640px]:text-[14px]"
            >
              Manage
            </a>
          </div>

          <label>
            <span className={labelClass}>Condition</span>
            <select
              value={condition}
              onChange={e => setCondition(e.target.value as Condition)}
              className={selectClass}
            >
              {CONDITIONS.map(c => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>

          <label className="sm:col-span-2">
            <span className={labelClass}>Size</span>
            <input
              type="text"
              value={size}
              onChange={e => setSize(e.target.value)}
              placeholder="Optional, e.g. US 9"
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
                  className="mt-1.5 text-[12px] font-medium text-foreground underline-offset-2 hover:underline max-[640px]:text-[14px]"
                >
                  Use this
                </button>
              </div>
            )}
          </label>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <span className={labelClass}>Purchased at</span>
            <div className="flex gap-2">
              <input
                type="text"
                inputMode="numeric"
                value={dateStr}
                onChange={e => setDateStr(maskDate(e.target.value))}
                placeholder="dd/mm/yyyy"
                className={inputClass + ' flex-1'}
              />
              <input
                type="time"
                value={timeStr}
                onChange={e => setTimeStr(e.target.value)}
                className={inputClass + ' w-[7.5rem] shrink-0'}
              />
            </div>
          </div>

          <div>
            <span className={labelClass}>Location</span>
            <LocationField
              value={location.name}
              onChange={place => setLocation(place)}
              placeholder="Where did you buy it?"
            />
          </div>
        </div>
      </div>

      <div className={cardClass}>
        <CurrencyField value={currency} onChange={setCurrency} />

        <label className="mt-5 block sm:max-w-[50%]">
          <span className={labelClass}>Retail price ({currency.price_currency})</span>
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            value={retailAmount}
            onChange={e => setRetailAmount(e.target.value)}
            placeholder="Optional"
            className={inputClass}
          />
        </label>
      </div>

      <div className={cardClass}>
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
              title="Look up photo, retail price, shipping and size from the web"
              className="hoppable mb-[1px] flex shrink-0 items-center gap-2 rounded-[10px] px-5 py-2.5 text-[13px] font-medium focus-visible:ring-2 focus-visible:ring-accent/30 disabled:cursor-not-allowed disabled:opacity-50 max-[640px]:text-[15px]"
            >
              {lookingUp && (
                <svg
                  className="h-3.5 w-3.5 animate-spin"
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
            <span className={labelClass}>Website link</span>
            <input
              type="url"
              value={websiteUrl}
              onChange={e => setWebsiteUrl(e.target.value)}
              placeholder="https://... product page"
              className={inputClass}
            />
          </label>

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
          className="hoppable hoppable-strong rounded-[10px] px-8 py-3 text-[13px] font-medium focus-visible:ring-2 focus-visible:ring-accent/40 disabled:cursor-not-allowed disabled:opacity-50 max-[640px]:text-[15px]"
        >
          {saving ? 'Saving...' : 'Confirm'}
        </button>
      </div>
    </form>
  )
}
