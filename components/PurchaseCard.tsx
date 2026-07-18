import Link from 'next/link'
import { formatMoney } from '@/lib/money'
import { Logo } from './Logo'
import type { Purchase } from '@/lib/types'

const CONDITION_LABEL: Record<string, string> = {
  new: 'New',
  'like-new': 'Like new',
  used: 'Used',
  refurbished: 'Refurbished',
}

type Props = {
  purchase: Purchase
  view?: 'grid' | 'list'
}

export function PurchaseCard({ purchase, view = 'grid' }: Props) {
  const {
    id,
    item_name,
    brand,
    photo_url,
    price_amount,
    price_currency,
    converted_amount,
    display_currency,
    condition,
    savings_amount,
    savings_currency,
  } = purchase

  const showConverted =
    converted_amount != null && display_currency != null && display_currency !== price_currency
  const showSaved = savings_amount != null && savings_amount > 0 && savings_currency

  const photo = (
    <div
      className={
        view === 'list'
          ? 'flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-[10px] bg-surface'
          : 'flex aspect-square w-full items-center justify-center overflow-hidden rounded-[10px] bg-surface'
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

  const details = (
    <div className={view === 'list' ? 'flex min-w-0 flex-1 flex-col justify-center gap-1' : 'flex flex-col gap-1 px-3.5 pb-3.5'}>
      <div className="flex items-start justify-between gap-2">
        <p className="truncate text-[13px] font-medium text-foreground max-[640px]:text-[15px]">{item_name}</p>
        {showSaved && (
          <span className="shrink-0 rounded-full bg-success/10 px-2 py-0.5 text-[11px] font-medium text-success max-[640px]:text-[12px]">
            Saved {formatMoney(savings_amount as number, savings_currency as string)}
          </span>
        )}
      </div>
      {brand && <p className="truncate text-[13px] text-foreground/60 max-[640px]:text-[14px]">{brand}</p>}
      <div className="mt-0.5 flex items-center gap-2">
        <span className="text-[13px] font-medium text-foreground max-[640px]:text-[14px]">
          {formatMoney(price_amount, price_currency)}
        </span>
        {showConverted && (
          <span className="text-[12px] text-foreground/50 max-[640px]:text-[13px]">
            ≈ {formatMoney(converted_amount as number, display_currency as string)}
          </span>
        )}
      </div>
      <span className="mt-1 inline-flex w-fit items-center rounded-full bg-black/5 px-2 py-0.5 text-[11px] text-foreground/70 max-[640px]:text-[12px] dark:bg-white/10">
        {CONDITION_LABEL[condition] ?? condition}
      </span>
    </div>
  )

  return (
    <Link
      href={`/purchases/${id}`}
      className="block rounded-[14px] bg-surface shadow-[0_14px_34px_-24px_rgba(0,0,0,.4)] transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 active:translate-y-0"
    >
      {view === 'list' ? (
        <div className="flex items-center gap-3 p-3">
          {photo}
          {details}
        </div>
      ) : (
        <div>
          {photo}
          {details}
        </div>
      )}
    </Link>
  )
}
