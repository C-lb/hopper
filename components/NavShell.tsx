'use client'

import type { ReactNode, SVGProps } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createBrowserSupabase } from '@/lib/supabase/client'
import { Logo } from './Logo'

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

function IconMap(props: IconProps) {
  return (
    <svg {...iconProps(props)}>
      <path d="M12 21s-7-6.1-7-11a7 7 0 0 1 14 0c0 4.9-7 11-7 11z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  )
}

function IconChart(props: IconProps) {
  return (
    <svg {...iconProps(props)}>
      <path d="M4 20V10" />
      <path d="M12 20V4" />
      <path d="M20 20v-7" />
    </svg>
  )
}

function IconRuler(props: IconProps) {
  return (
    <svg {...iconProps(props)}>
      <rect x="3" y="7" width="18" height="10" rx="1.5" transform="rotate(-2 12 12)" />
      <path d="M7.5 7.5v3M11.5 7v3.5M15.5 7.5v3" />
    </svg>
  )
}

function IconLogOut(props: IconProps) {
  return (
    <svg {...iconProps(props)}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  )
}

const NAV_ITEMS = [
  { href: '/catalogue', label: 'Catalogue', Icon: IconGrid },
  { href: '/map', label: 'Map', Icon: IconMap },
  { href: '/dashboard', label: 'Dashboard', Icon: IconChart },
  { href: '/measurements', label: 'Measurements', Icon: IconRuler },
]

export function NavShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()

  // The login page is unauthenticated and renders its own centred layout.
  if (pathname === '/login') return <>{children}</>

  async function handleSignOut() {
    const supabase = createBrowserSupabase()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="flex min-h-full flex-col lg:flex-row">
      <aside className="hidden shrink-0 flex-col justify-between border-r border-black/5 bg-surface px-4 py-6 lg:flex lg:w-60 dark:border-white/5">
        <div>
          <div className="flex items-center gap-2.5 px-2 pb-8 text-foreground">
            <Logo size={28} />
            <span className="text-base font-semibold tracking-tight">Hopper</span>
          </div>
          <nav className="flex flex-col gap-1">
            {NAV_ITEMS.map(({ href, label, Icon }) => {
              const active = pathname?.startsWith(href)
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  className={`flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-sm transition-colors ${
                    active
                      ? 'bg-accent text-accent-foreground'
                      : 'text-foreground/70 hover:bg-black/5 hover:text-foreground dark:hover:bg-white/5'
                  }`}
                >
                  <Icon className="h-[1.1em] w-[1.1em] shrink-0" />
                  {label}
                </Link>
              )
            })}
          </nav>
        </div>
        <button
          type="button"
          onClick={handleSignOut}
          className="flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-left text-sm text-foreground/70 transition-colors hover:bg-black/5 hover:text-danger active:opacity-70 dark:hover:bg-white/5"
        >
          <IconLogOut className="h-[1.1em] w-[1.1em] shrink-0" />
          Sign out
        </button>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex items-center gap-2.5 px-4 py-4 text-foreground lg:hidden">
          <Logo size={24} />
          <span className="text-base font-semibold tracking-tight">Hopper</span>
        </header>

        <main className="flex-1 pb-20 lg:pb-0">{children}</main>
      </div>

      <nav
        className="fixed inset-x-0 bottom-0 z-10 flex items-stretch justify-around border-t border-black/5 bg-surface px-1 py-1.5 shadow-[0_-8px_24px_-16px_rgba(0,0,0,.3)] lg:hidden dark:border-white/5"
        aria-label="Primary"
      >
        {NAV_ITEMS.map(({ href, label, Icon }) => {
          const active = pathname?.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={`flex flex-1 flex-col items-center gap-1 rounded-[10px] px-2 py-1.5 text-[11px] transition-colors ${
                active ? 'text-accent' : 'text-foreground/60'
              }`}
            >
              <Icon className="h-5 w-5" />
              {label}
            </Link>
          )
        })}
        <button
          type="button"
          onClick={handleSignOut}
          className="flex flex-1 flex-col items-center gap-1 rounded-[10px] px-2 py-1.5 text-[11px] text-foreground/60 transition-colors active:opacity-70"
        >
          <IconLogOut className="h-5 w-5" />
          Sign out
        </button>
      </nav>
    </div>
  )
}
