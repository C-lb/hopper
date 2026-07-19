'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { createBrowserSupabase } from '@/lib/supabase/client'
import { LocationField } from '@/components/LocationField'
import { CURRENCIES } from '@/lib/currencies'
import type { UserSettings } from '@/lib/types'

const inputClass =
  'w-full rounded-[10px] border border-black/10 bg-background px-4 py-2.5 text-[13px] text-foreground outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 max-[640px]:text-[17px]'
const selectClass = inputClass + ' appearance-none'
const labelClass = 'mb-1.5 block text-[13px] text-foreground/70 max-[640px]:text-[15px]'

const TIMEZONES = [
  'Asia/Singapore',
  'UTC',
  'America/New_York',
  'Europe/London',
  'Asia/Tokyo',
  'Australia/Sydney',
]

function deviceTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  label: string
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3 text-[13px] text-foreground/80 max-[640px]:text-[15px]">
      <span
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
          checked ? 'bg-white' : 'bg-black/15 dark:bg-white/15'
        }`}
      >
        <span
          className={`inline-block h-4.5 w-4.5 transform rounded-full bg-black transition-transform ${
            checked ? 'translate-x-6 bg-black' : 'translate-x-1 bg-foreground/60'
          }`}
        />
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only"
      />
      {label}
    </label>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[20px] bg-surface p-6 shadow-[0_14px_34px_-18px_rgba(0,0,0,.35)]">
      <h2 className="mb-4 text-base font-semibold tracking-tight text-foreground">{title}</h2>
      {children}
    </section>
  )
}

export default function AboutPage() {
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)

  // Account
  const [email, setEmail] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [accountSaving, setAccountSaving] = useState(false)
  const [accountError, setAccountError] = useState<string | null>(null)
  const [accountSaved, setAccountSaved] = useState<string | null>(null)

  // Defaults
  const [location, setLocation] = useState<{ name: string; lat: number | null; lng: number | null }>({
    name: '',
    lat: null,
    lng: null,
  })
  const [timezone, setTimezone] = useState(deviceTimezone())
  const [autoUseTimezone, setAutoUseTimezone] = useState(true)
  const [defaultCurrency, setDefaultCurrency] = useState(CURRENCIES[0]?.code ?? 'SGD')
  const [displayDefaultCurrency, setDisplayDefaultCurrency] = useState(false)
  const [defaultsSaving, setDefaultsSaving] = useState(false)
  const [defaultsError, setDefaultsError] = useState<string | null>(null)
  const [defaultsSaved, setDefaultsSaved] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)

      const supabase = createBrowserSupabase()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        if (!cancelled) {
          setAccountError('You must be signed in to view this page.')
          setLoading(false)
        }
        return
      }

      if (cancelled) return
      setUserId(user.id)
      setEmail(user.email ?? '')
      setNewEmail(user.email ?? '')

      const { data: settingsData } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()

      if (cancelled) return

      if (settingsData) {
        const settings = settingsData as UserSettings
        setLocation({
          name: settings.default_location_name ?? '',
          lat: settings.default_location_lat,
          lng: settings.default_location_lng,
        })
        setTimezone(settings.default_timezone ?? deviceTimezone())
        setAutoUseTimezone(settings.auto_use_timezone ?? true)
        setDefaultCurrency(settings.default_currency ?? CURRENCIES[0]?.code ?? 'SGD')
        setDisplayDefaultCurrency(settings.display_default_currency ?? false)
      }

      setLoading(false)
    }

    load()

    return () => {
      cancelled = true
    }
  }, [])

  async function handleEmailUpdate(e: FormEvent) {
    e.preventDefault()
    setAccountError(null)
    setAccountSaved(null)

    if (!newEmail.trim() || newEmail.trim() === email) return

    setAccountSaving(true)
    const supabase = createBrowserSupabase()
    const { error } = await supabase.auth.updateUser({ email: newEmail.trim() })
    setAccountSaving(false)

    if (error) {
      setAccountError(error.message)
      return
    }

    setAccountSaved('Email update requested. Check your inbox to confirm.')
  }

  async function handlePasswordUpdate(e: FormEvent) {
    e.preventDefault()
    setAccountError(null)
    setAccountSaved(null)

    if (!newPassword.trim()) return

    setAccountSaving(true)
    const supabase = createBrowserSupabase()
    const { error } = await supabase.auth.updateUser({ password: newPassword.trim() })
    setAccountSaving(false)

    if (error) {
      setAccountError(error.message)
      return
    }

    setNewPassword('')
    setAccountSaved('Password updated.')
  }

  async function handleDefaultsSave() {
    if (!userId) return

    setDefaultsSaving(true)
    setDefaultsError(null)
    setDefaultsSaved(false)

    const supabase = createBrowserSupabase()
    const { error } = await supabase.from('user_settings').upsert({
      user_id: userId,
      default_location_name: location.name.trim() || null,
      default_location_lat: location.lat,
      default_location_lng: location.lng,
      default_timezone: timezone,
      auto_use_timezone: autoUseTimezone,
      default_currency: defaultCurrency,
      display_default_currency: displayDefaultCurrency,
    })

    setDefaultsSaving(false)

    if (error) {
      setDefaultsError(error.message)
      return
    }

    setDefaultsSaved(true)
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-10 lg:px-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">About</h1>
      </div>

      {loading ? (
        <p className="text-sm text-foreground/60">Loading...</p>
      ) : (
        <div className="flex flex-col gap-6">
          <Section title="Account">
            <form onSubmit={handleEmailUpdate} className="flex flex-col gap-3">
              <label>
                <span className={labelClass}>Email</span>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className={inputClass}
                />
              </label>
              <button
                type="submit"
                disabled={accountSaving || !newEmail.trim() || newEmail.trim() === email}
                className="hoppable self-start rounded-[10px] px-5 py-2.5 text-[13px] font-medium disabled:cursor-not-allowed disabled:opacity-50"
              >
                {accountSaving ? 'Updating...' : 'Update email'}
              </button>
            </form>

            <form onSubmit={handlePasswordUpdate} className="mt-4 flex flex-col gap-3">
              <label>
                <span className={labelClass}>New password</span>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  className={inputClass}
                />
              </label>
              <button
                type="submit"
                disabled={accountSaving || !newPassword.trim()}
                className="hoppable self-start rounded-[10px] px-5 py-2.5 text-[13px] font-medium disabled:cursor-not-allowed disabled:opacity-50"
              >
                {accountSaving ? 'Updating...' : 'Update password'}
              </button>
            </form>

            {accountError && (
              <p role="alert" className="mt-4 text-sm text-danger">
                {accountError}
              </p>
            )}
            {accountSaved && !accountError && (
              <p role="status" className="mt-4 text-sm text-success">
                {accountSaved}
              </p>
            )}
          </Section>

          <Section title="Defaults">
            <div className="flex flex-col gap-4">
              <label>
                <span className={labelClass}>Default location</span>
                <LocationField
                  value={location.name}
                  onChange={(place) => {
                    setDefaultsSaved(false)
                    setLocation(place)
                  }}
                  placeholder="Search for a location"
                />
              </label>

              <label>
                <span className={labelClass}>Default timezone</span>
                <select
                  value={timezone}
                  onChange={(e) => {
                    setDefaultsSaved(false)
                    setTimezone(e.target.value)
                  }}
                  className={selectClass}
                >
                  {[...new Set([timezone, ...TIMEZONES])].map((tz) => (
                    <option key={tz} value={tz}>
                      {tz}
                    </option>
                  ))}
                </select>
              </label>

              <Toggle
                checked={autoUseTimezone}
                onChange={(next) => {
                  setDefaultsSaved(false)
                  setAutoUseTimezone(next)
                }}
                label="Automatically use my default timezone"
              />

              <label>
                <span className={labelClass}>Default currency</span>
                <select
                  value={defaultCurrency}
                  onChange={(e) => {
                    setDefaultsSaved(false)
                    setDefaultCurrency(e.target.value)
                  }}
                  className={selectClass}
                >
                  {CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code} — {c.name}
                    </option>
                  ))}
                </select>
              </label>

              <Toggle
                checked={displayDefaultCurrency}
                onChange={(next) => {
                  setDefaultsSaved(false)
                  setDisplayDefaultCurrency(next)
                }}
                label="Also display my default currency"
              />
            </div>

            {defaultsError && (
              <p role="alert" className="mt-4 text-sm text-danger">
                {defaultsError}
              </p>
            )}
            {defaultsSaved && !defaultsError && (
              <p role="status" className="mt-4 text-sm text-success">
                Saved.
              </p>
            )}

            <button
              type="button"
              onClick={handleDefaultsSave}
              disabled={defaultsSaving}
              className="hoppable hoppable-strong mt-6 rounded-[10px] px-6 py-3 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
            >
              {defaultsSaving ? 'Saving...' : 'Save defaults'}
            </button>
          </Section>
        </div>
      )}
    </div>
  )
}
