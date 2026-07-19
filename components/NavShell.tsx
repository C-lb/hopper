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

function IconGear(props: IconProps) {
  return (
    <svg {...iconProps(props)}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
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
  { href: '/about', label: 'About', Icon: IconGear },
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
      <aside className="hidden shrink-0 flex-col justify-between border-r border-white/5 bg-background px-4 py-6 lg:flex lg:w-60">
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
                  className={`flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-sm ${
                    active ? 'bg-white text-black' : 'hoppable'
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
          className="hoppable flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-left text-sm"
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
        className="fixed inset-x-0 bottom-0 z-10 flex items-stretch justify-around gap-1 border-t border-white/5 bg-background px-2 py-2 shadow-[0_-8px_24px_-16px_rgba(0,0,0,.6)] lg:hidden"
        aria-label="Primary"
      >
        {NAV_ITEMS.map(({ href, label, Icon }) => {
          const active = pathname?.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={`flex flex-1 flex-col items-center gap-1 rounded-[10px] px-2 py-1.5 text-[11px] ${
                active ? 'bg-white text-black' : 'hoppable'
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
          className="hoppable flex flex-1 flex-col items-center gap-1 rounded-[10px] px-2 py-1.5 text-[11px]"
        >
          <IconLogOut className="h-5 w-5" />
          Sign out
        </button>
      </nav>
    </div>
  )
}
