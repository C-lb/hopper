'use client'

import { useEffect, useState, type ChangeEvent } from 'react'
import { createBrowserSupabase } from '@/lib/supabase/client'
import type { BodyProfile } from '@/lib/types'

type NumberField = Exclude<keyof BodyProfile, 'user_id' | 'notes' | 'updated_at'>

const NUMBER_FIELDS: { key: NumberField; label: string; unit: string }[] = [
  { key: 'height_cm', label: 'Height', unit: 'cm' },
  { key: 'weight_kg', label: 'Weight', unit: 'kg' },
  { key: 'chest_cm', label: 'Chest', unit: 'cm' },
  { key: 'waist_cm', label: 'Waist', unit: 'cm' },
  { key: 'hips_cm', label: 'Hips', unit: 'cm' },
  { key: 'inseam_cm', label: 'Inseam', unit: 'cm' },
  { key: 'shoulder_cm', label: 'Shoulder', unit: 'cm' },
  { key: 'foot_length_cm', label: 'Foot length', unit: 'cm' },
]

type FormState = Record<NumberField, string> & { notes: string }

const EMPTY_FORM: FormState = {
  height_cm: '',
  weight_kg: '',
  chest_cm: '',
  waist_cm: '',
  hips_cm: '',
  inseam_cm: '',
  shoulder_cm: '',
  foot_length_cm: '',
  notes: '',
}

export default function MeasurementsPage() {
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)

      const supabase = createBrowserSupabase()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        if (!cancelled) {
          setError('You must be signed in to view measurements.')
          setLoading(false)
        }
        return
      }

      const { data, error: fetchError } = await supabase
        .from('body_profile')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()

      if (cancelled) return

      if (fetchError) {
        setError(fetchError.message)
        setLoading(false)
        return
      }

      if (data) {
        const profile = data as BodyProfile
        setForm({
          height_cm: profile.height_cm?.toString() ?? '',
          weight_kg: profile.weight_kg?.toString() ?? '',
          chest_cm: profile.chest_cm?.toString() ?? '',
          waist_cm: profile.waist_cm?.toString() ?? '',
          hips_cm: profile.hips_cm?.toString() ?? '',
          inseam_cm: profile.inseam_cm?.toString() ?? '',
          shoulder_cm: profile.shoulder_cm?.toString() ?? '',
          foot_length_cm: profile.foot_length_cm?.toString() ?? '',
          notes: profile.notes ?? '',
        })
      }

      setLoading(false)
    }

    load()

    return () => {
      cancelled = true
    }
  }, [])

  function handleFieldChange(key: NumberField) {
    return (e: ChangeEvent<HTMLInputElement>) => {
      setSaved(false)
      setForm((prev) => ({ ...prev, [key]: e.target.value }))
    }
  }

  function handleNotesChange(e: ChangeEvent<HTMLTextAreaElement>) {
    setSaved(false)
    setForm((prev) => ({ ...prev, notes: e.target.value }))
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    setSaved(false)

    const supabase = createBrowserSupabase()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setError('You must be signed in to save measurements.')
      setSaving(false)
      return
    }

    const values = Object.fromEntries(
      NUMBER_FIELDS.map(({ key }) => {
        const raw = form[key].trim()
        const parsed = raw === '' ? null : Number(raw)
        return [key, parsed === null || Number.isNaN(parsed) ? null : parsed]
      })
    )

    const { error: upsertError } = await supabase.from('body_profile').upsert({
      user_id: user.id,
      ...values,
      notes: form.notes.trim() || null,
    })

    setSaving(false)

    if (upsertError) {
      setError(upsertError.message)
      return
    }

    setSaved(true)
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-10 lg:px-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Measurements</h1>
        <p className="mt-2 text-sm text-foreground/60">
          Keep your body measurements up to date to get better size recommendations.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-foreground/60">Loading...</p>
      ) : (
        <div className="rounded-[20px] bg-surface p-6 shadow-[0_14px_34px_-18px_rgba(0,0,0,.35)]">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {NUMBER_FIELDS.map(({ key, label, unit }) => (
              <label key={key} className="flex flex-col gap-1.5">
                <span className="text-sm text-foreground/80">
                  {label} <span className="text-foreground/50">({unit})</span>
                </span>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  min={0}
                  value={form[key]}
                  onChange={handleFieldChange(key)}
                  placeholder="Not set"
                  className="rounded-[10px] border border-black/10 bg-background px-4 py-2.5 text-sm text-foreground outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 dark:border-white/10"
                />
              </label>
            ))}
          </div>

          <label className="mt-4 flex flex-col gap-1.5">
            <span className="text-sm text-foreground/80">Notes</span>
            <textarea
              value={form.notes}
              onChange={handleNotesChange}
              rows={3}
              placeholder="Anything else worth noting (fit preferences, brand quirks, etc.)"
              className="resize-none rounded-[10px] border border-black/10 bg-background px-4 py-2.5 text-sm text-foreground outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 dark:border-white/10"
            />
          </label>

          {error && (
            <p role="alert" className="mt-4 text-sm text-danger">
              {error}
            </p>
          )}

          {saved && !error && (
            <p role="status" className="mt-4 text-sm text-accent">
              Saved.
            </p>
          )}

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="mt-6 rounded-[10px] bg-accent px-6 py-3 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90 active:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save measurements'}
          </button>
        </div>
      )}
    </div>
  )
}
