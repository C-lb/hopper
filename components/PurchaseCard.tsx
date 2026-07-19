'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { formatMoney, round2 } from '@/lib/money'
import { getRate } from '@/lib/displayFx'
import { Logo } from './Logo'
import type { Purchase } from '@/lib/types'

const CONDITION_LABEL: Record<string, string> = {
  new: 'New',
  defective: 'Defective',
  refurbished: 'Refurbished',
  A: 'Grade A',
  B: 'Grade B',
  C: 'Grade C',
  D: 'Grade D',
}

type Props = {
  purchase: Purchase
  view?: 'grid' | 'list'
  defaultCurrency?: string | null
  displayDefaultCurrency?: boolean
}

function IconPencil() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-3.5 w-3.5"
      aria-hidden
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  )
}

export function PurchaseCard({
  purchase,
  view = 'grid',
  defaultCurrency,
  displayDefaultCurrency = false,
}: Props) {
  const {
    id,
    item_name,
    brand,
    photo_url,
    price_amount,
    price_currency,
    msrp_amount,
    shipping_fee,
    size,
    condition,
    website_url,
    purchased_at,
  } = purchase

  const wantsConversion =
    displayDefaultCurrency && !!defaultCurrency && defaultCurrency !== price_currency

  const [rate, setRate] = useState<number | null>(null)

  useEffect(() => {
    if (!wantsConversion || !defaultCurrency) {
      setRate(null)
      return
    }
    let active = true
    getRate(price_currency, defaultCurrency, purchased_at).then(r => {
      if (active) setRate(r)
    })
    return () => {
      active = false
    }
  }, [wantsConversion, defaultCurrency, price_currency, purchased_at])

  const canConvert = wantsConversion && defaultCurrency != null && rate != null

  const retail = msrp_amount
  const retailColor =
    retail == null
      ? 'text-foreground/70'
      : retail > price_amount
        ? 'text-success'
        : retail < price_amount
          ? 'text-danger'
          : 'text-foreground/70'

  const retailPlusShipping = retail != null ? retail + (shipping_fee ?? 0) : null

  const photo = (
    <div
      className={
        view === 'list'
          ? 'flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-[10px] bg-surface-2'
          : 'flex aspect-square w-full items-center justify-center overflow-hidden rounded-[10px] bg-surface-2'
      }
    >
      {photo_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo_url} alt={item_name} className="h-full w-full object-cover" />
      ) : (
        <Logo size={view === 'list' ? 24 : 32} />
      )}
    </div>
  )

  const title = website_url ? (
    <a
      href={website_url}
      target="_blank"
      rel="noopener noreferrer"
      className="truncate font-semibold text-foreground underline-offset-2 hover:underline focus-visible:underline focus-visible:outline-none max-[640px]:text-[16px]"
      title={item_name}
    >
      {item_name}
    </a>
  ) : (
    <span className="truncate font-semibold text-foreground max-[640px]:text-[16px]" title={item_name}>
      {item_name}
    </span>
  )

  const details = (
    <div
      className={
        view === 'list'
          ? 'flex min-w-0 flex-1 flex-col justify-center gap-1'
          : 'flex flex-col gap-1 px-3.5 pb-3.5 pt-3'
      }
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="min-w-0 truncate text-[15px] leading-tight max-[640px]:text-[16px]">{title}</span>
          {brand && (
            <span className="truncate text-[12px] text-foreground/55 max-[640px]:text-[13px]">{brand}</span>
          )}
        </div>
        <Link
          href={`/purchases/${id}`}
          aria-label={`Edit ${item_name}`}
          title="Edit"
          className="hoppable inline-flex shrink-0 items-center justify-center rounded-[8px] p-1.5"
        >
          <IconPencil />
        </Link>
      </div>

      <div className="mt-0.5 flex flex-col gap-0.5">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-[14px] font-medium text-foreground max-[640px]:text-[15px]">
            {formatMoney(price_amount, price_currency)}
          </span>
          {canConvert && (
            <span className="text-[12px] text-foreground/45 max-[640px]:text-[13px]">
              ≈ {formatMoney(round2(price_amount * (rate as number)), defaultCurrency as string)}
            </span>
          )}
        </div>

        {retail != null && (
          <div className="text-[12px] text-foreground/60 max-[640px]:text-[13px]">
            Retail <span className={`font-medium ${retailColor}`}>{formatMoney(retail, price_currency)}</span>
            {shipping_fee != null && (
              <span className="text-foreground/50"> (+ {formatMoney(shipping_fee, price_currency)})</span>
            )}
            {canConvert && retailPlusShipping != null && (
              <span className="text-foreground/45">
                {' '}
                ≈ {formatMoney(round2(retailPlusShipping * (rate as number)), defaultCurrency as string)}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="mt-1 flex flex-wrap items-center gap-1.5">
        <span className="inline-flex w-fit items-center rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-foreground/70 max-[640px]:text-[12px]">
          {CONDITION_LABEL[condition] ?? condition}
        </span>
        {size && (
          <span className="inline-flex w-fit items-center rounded-full bg-white/5 px-2 py-0.5 text-[11px] text-foreground/60 max-[640px]:text-[12px]">
            {size}
          </span>
        )}
      </div>
    </div>
  )

  return (
    <div className="rounded-[14px] bg-surface shadow-[0_14px_34px_-24px_rgba(0,0,0,.4)]">
      {view === 'list' ? (
        <div className="flex items-center gap-3 p-3">
          {photo}
          {details}
        </div>
      ) : (
        <div className="p-1.5">
          {photo}
          {details}
        </div>
      )}
    </div>
  )
}
