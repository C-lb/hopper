// proxy.ts
//
// Route guard: runs before every non-static, non-API request. Redirects
// unauthenticated users to /login, and redirects already-authenticated users
// away from /login to /catalogue.
//
// Named `proxy.ts` (not `middleware.ts`): Next.js 16 deprecated the
// `middleware` file convention and renamed it to `proxy` (see
// node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md).
// `middleware.ts` still works but emits a deprecation notice, so this project
// uses the current convention per AGENTS.md.
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(req: NextRequest) {
  const res = NextResponse.next()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (c) => c.forEach(({ name, value, options }) => res.cookies.set(name, value, options)),
      },
    }
  )
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const isAuthPage = req.nextUrl.pathname.startsWith('/login')
  if (!user && !isAuthPage) return NextResponse.redirect(new URL('/login', req.url))
  if (user && isAuthPage) return NextResponse.redirect(new URL('/catalogue', req.url))
  return res
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico|api/).*)'] }
