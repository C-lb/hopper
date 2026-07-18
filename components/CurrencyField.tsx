'use client'

import { useEffect, useRef, useState } from 'react'
import { CURRENCIES } from '@/lib/currencies'
import { fetchRate, convert } from '@/lib/fx'
import { formatMoney } from '@/lib/money'

export type CurrencyFieldValue = {
  price_amount: number
  price_currency: string
  display_currency: string
  fx_rate: number | null
  fx_rate_date: string | null
  converted_amount: number | null
}

type Props = {
  value: CurrencyFieldValue
  onChange: (value: CurrencyFieldValue) => void
  purchasedAt: string | null
  disabled?: boolean
}

/** Calendar date (YYYY-MM-DD) from a datetime-local string like "2026-07-19T10:30". */
function dateOf(datetime: string | null): string | null {
  if (!datetime) return null
  return datetime.slice(0, 10)
}

export function CurrencyField({ value, onChange, purchasedAt, disabled }: Props) {
  const { price_amount, price_currency, display_currency } = value
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [manualRate, setManualRate] = useState<string>('')
  const requestId = useRef(0)

  const fxDate = dateOf(purchasedAt)
  const needsConversion = price_currency !== display_currency

  useEffect(() => {
    if (!needsConversion) {
      // loading/error are only ever rendered while needsConversion is true,
      // so no need to reset them here.
      onChange({ ...value, fx_rate: 1, fx_rate_date: fxDate, converted_amount: price_amount })
      return
    }

    if (!fxDate || !Number.isFinite(price_amount)) {
      return
    }

    const id = ++requestId.current

    async function load() {
      setLoading(true)
      setError(false)

      try {
        const { rate, date } = await fetchRate(price_currency, display_currency, fxDate as string)
        if (id !== requestId.current) return
        setLoading(false)
        onChange({
          ...value,
          fx_rate: rate,
          fx_rate_date: date,
          converted_amount: convert(price_amount, rate),
        })
      } catch {
        if (id !== requestId.current) return
        setLoading(false)
        setError(true)
      }
    }

    load()

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [price_amount, price_currency, display_currency, fxDate, needsConversion])

  function handleManualRate(rateText: string) {
    setManualRate(rateText)
    const rate = parseFloat(rateText)
    if (!Number.isFinite(rate)) return
    onChange({
      ...value,
      fx_rate: rate,
      fx_rate_date: fxDate,
      converted_amount: convert(price_amount, rate),
    })
  }

  const inputClass =
    'w-full rounded-[10px] border border-black/10 bg-background px-4 py-2.5 text-[13px] text-foreground outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 max-[640px]:text-[17px]'
  const selectClass = inputClass + ' appearance-none'

  return (
    <div className="space-y-3">
      <div>
        <label className="mb-1.5 block text-[13px] text-foreground/70 max-[640px]:text-[15px]">
          Amount paid
        </label>
        <input
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          disabled={disabled}
          value={Number.isFinite(price_amount) ? price_amount : ''}
          onChange={e => onChange({ ...value, price_amount: parseFloat(e.target.value) || 0 })}
          className={inputClass}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1.5 block text-[13px] text-foreground/70 max-[640px]:text-[15px]">
            Paid in
          </label>
          <select
            disabled={disabled}
            value={price_currency}
            onChange={e => onChange({ ...value, price_currency: e.target.value })}
            className={selectClass}
          >
            {CURRENCIES.map(c => (
              <option key={c.code} value={c.code}>
                {c.code} — {c.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-[13px] text-foreground/70 max-[640px]:text-[15px]">
            Display in
          </label>
          <select
            disabled={disabled}
            value={display_currency}
            onChange={e => onChange({ ...value, display_currency: e.target.value })}
            className={selectClass}
          >
            {CURRENCIES.map(c => (
              <option key={c.code} value={c.code}>
                {c.code} — {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {needsConversion && (
        <div className="flex min-h-[1.25rem] items-center gap-2 text-[13px] text-foreground/60 max-[640px]:text-[14px]">
          {loading && (
            <span
              aria-hidden
              className="h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-foreground/20 border-t-accent"
            />
          )}
          {!loading && !error && value.converted_amount != null && (
            <span>
              {formatMoney(price_amount, price_currency)} ≈{' '}
              {formatMoney(value.converted_amount, display_currency)}
            </span>
          )}
        </div>
      )}

      {needsConversion && error && (
        <div className="space-y-1.5 rounded-[10px] border border-warn/30 bg-warn/10 px-3 py-2">
          <p className="text-[13px] text-warn max-[640px]:text-[14px]">
            Rate unavailable, enter manually
          </p>
          <input
            type="number"
            inputMode="decimal"
            step="0.0001"
            min="0"
            placeholder={`1 ${price_currency} = ? ${display_currency}`}
            disabled={disabled}
            value={manualRate}
            onChange={e => handleManualRate(e.target.value)}
            className={inputClass}
          />
          {value.converted_amount != null && manualRate !== '' && (
            <p className="text-[13px] text-foreground/60 max-[640px]:text-[14px]">
              {formatMoney(price_amount, price_currency)} ≈{' '}
              {formatMoney(value.converted_amount, display_currency)}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
