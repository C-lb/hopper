import type { ReactNode } from 'react'

type Props = {
  label: string
  value: ReactNode
  hint?: string
}

export function Stat({ label, value, hint }: Props) {
  return (
    <div className="rounded-[14px] bg-surface px-4 py-4 shadow-[0_14px_34px_-24px_rgba(0,0,0,.4)]">
      <p className="text-[13px] text-foreground/60 max-[640px]:text-[14px]">{label}</p>
      <p className="mt-1.5 text-2xl font-semibold tracking-tight text-foreground">{value}</p>
      {hint && <p className="mt-1 text-[12px] text-foreground/50 max-[640px]:text-[13px]">{hint}</p>}
    </div>
  )
}
