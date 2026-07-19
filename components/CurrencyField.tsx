'use client'

import { CURRENCIES } from '@/lib/currencies'

export type CurrencyFieldValue = {
  price_amount: number
  price_currency: string
}

type Props = {
  value: CurrencyFieldValue
  onChange: (value: CurrencyFieldValue) => void
  disabled?: boolean
}

const labelClass = 'mb-1.5 block text-[13px] text-foreground/70 max-[640px]:text-[15px]'
const fieldBase =
  'w-full rounded-[12px] border border-black/10 bg-background text-foreground outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10'
const amountClass = fieldBase + ' px-4 py-3 text-3xl font-semibold tracking-tight'
const selectClass = fieldBase + ' appearance-none px-4 py-3 text-[15px] max-[640px]:text-[17px]'

export function CurrencyField({ value, onChange, disabled }: Props) {
  const { price_amount, price_currency } = value

  return (
    <div className="grid grid-cols-[2fr_1fr] items-end gap-3">
      <div>
        <label className={labelClass}>Purchase price</label>
        <input
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          disabled={disabled}
          value={Number.isFinite(price_amount) ? price_amount : ''}
          onChange={e => onChange({ ...value, price_amount: parseFloat(e.target.value) || 0 })}
          className={amountClass}
        />
      </div>

      <div>
        <label className={labelClass}>Paid in</label>
        <select
          disabled={disabled}
          value={price_currency}
          onChange={e => onChange({ ...value, price_currency: e.target.value })}
          className={selectClass}
        >
          {CURRENCIES.map(c => (
            <option key={c.code} value={c.code}>
              {c.code}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
