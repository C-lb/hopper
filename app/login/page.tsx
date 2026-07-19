'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserSupabase } from '@/lib/supabase/client'

type Mode = 'sign-in' | 'sign-up'

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('sign-in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const isSignUp = mode === 'sign-up'

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const supabase = createBrowserSupabase()
    const { error } = isSignUp
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password })

    setLoading(false)

    if (error) {
      setError(error.message)
      return
    }

    router.push('/catalogue')
  }

  return (
    <div className="flex flex-1 items-center justify-center bg-background px-4 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Hopper</h1>
          <p className="mt-2 text-sm text-foreground/60">
            {isSignUp ? 'Create an account to get started.' : 'Sign in to your account.'}
          </p>
        </div>

        <div className="rounded-[20px] bg-surface p-6 shadow-[0_14px_34px_-18px_rgba(0,0,0,.35)]">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm text-foreground/80">Email</span>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="rounded-[10px] border border-black/10 bg-background px-4 py-2.5 text-sm text-foreground outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 dark:border-white/10"
                placeholder="you@example.com"
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-sm text-foreground/80">Password</span>
              <input
                type="password"
                required
                minLength={6}
                autoComplete={isSignUp ? 'new-password' : 'current-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="rounded-[10px] border border-black/10 bg-background px-4 py-2.5 text-sm text-foreground outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 dark:border-white/10"
                placeholder="At least 6 characters"
              />
            </label>

            {error && (
              <p role="alert" className="text-sm text-danger">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="hoppable hoppable-strong mt-2 rounded-[10px] px-6 py-3 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? 'Please wait...' : isSignUp ? 'Sign up' : 'Sign in'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-foreground/60">
            {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
            <button
              type="button"
              onClick={() => {
                setError(null)
                setMode(isSignUp ? 'sign-in' : 'sign-up')
              }}
              className="font-medium text-accent hover:underline"
            >
              {isSignUp ? 'Sign in' : 'Sign up'}
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
