'use client'

import { useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { createBrowserSupabase } from '@/lib/supabase/client'
import type { BodyProfile } from '@/lib/types'
import {
  type Unit,
  type Dim,
  type ShoeSystem,
  unitLabel,
  formatDisplay,
  metricFromDisplay,
  nearestShoeRow,
  bmi,
} from '@/lib/measurements'
import type { BodyDims } from '@/components/three/BodyAvatar'
import type { FootDims } from '@/components/three/FootModel'

// three.js touches window, so the 3D canvases load client-only.
const BodyAvatar = dynamic(() => import('@/components/three/BodyAvatar'), {
  ssr: false,
  loading: () => <ViewportFallback label="Loading model" />,
})
const FootModel = dynamic(() => import('@/components/three/FootModel'), {
  ssr: false,
  loading: () => <ViewportFallback label="Loading model" />,
})

const inputClass =
  'w-full rounded-[10px] border border-black/10 bg-background px-4 py-2.5 text-[13px] text-foreground outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 max-[640px]:text-[17px]'

// ---------------------------------------------------------------------------
// Field definitions. Numeric body fields map either to a fixed body_profile
// column (`core`) or to a key inside body_profile.extended (`ext`).
// ---------------------------------------------------------------------------
type BodyFieldId =
  | 'height' | 'weight' | 'chest' | 'sleeve' | 'shoulder'
  | 'waist' | 'hips' | 'inseam' | 'leg' | 'thumb' | 'finger'

interface BodyField {
  id: BodyFieldId
  label: string
  dim: Dim
  core?: keyof BodyProfile
  ext?: string
}

const BODY_FIELDS: BodyField[] = [
  { id: 'height', label: 'Height', dim: 'len_cm', core: 'height_cm' },
  { id: 'weight', label: 'Weight', dim: 'mass', core: 'weight_kg' },
  { id: 'chest', label: 'Chest circumference', dim: 'len_cm', core: 'chest_cm' },
  { id: 'sleeve', label: 'Sleeve length', dim: 'len_cm', ext: 'sleeve_cm' },
  { id: 'shoulder', label: 'Shoulder width', dim: 'len_cm', core: 'shoulder_cm' },
  { id: 'waist', label: 'Waist length', dim: 'len_cm', core: 'waist_cm' },
  { id: 'hips', label: 'Hips length', dim: 'len_cm', core: 'hips_cm' },
  { id: 'inseam', label: 'Inseam length', dim: 'len_cm', core: 'inseam_cm' },
  { id: 'leg', label: 'Leg length', dim: 'len_cm', ext: 'leg_length_cm' },
  { id: 'thumb', label: 'Thumb circumference', dim: 'circ_mm', ext: 'thumb_circ_mm' },
  { id: 'finger', label: 'Finger circumference', dim: 'circ_mm', ext: 'finger_circ_mm' },
]

const SIZE_FIELDS = [
  { id: 'shirt_size', label: 'Default shirt size', placeholder: 'e.g. M' },
  { id: 'pants_size', label: 'Default pants size', placeholder: 'e.g. 32' },
  { id: 'ring_size', label: 'Default ring size', placeholder: 'e.g. US 9' },
] as const
type SizeId = (typeof SIZE_FIELDS)[number]['id']

interface FootField {
  id: keyof FootDims
  label: string
}
const FOOT_FIELDS: FootField[] = [
  { id: 'foot_length_mm', label: 'Foot length' },
  { id: 'foot_breadth_mm', label: 'Foot breadth' },
  { id: 'ball_girth_mm', label: 'Ball girth' },
  { id: 'heel_breadth_mm', label: 'Heel breadth' },
  { id: 'arch_height_mm', label: 'Arch height' },
  { id: 'instep_height_mm', label: 'Instep height' },
]

const SHOE_FIELDS: { id: ShoeSystem; label: string }[] = [
  { id: 'eu', label: 'EU' },
  { id: 'us', label: 'US' },
  { id: 'jpn', label: 'JPN' },
]

type Side = 'left' | 'right'
type StrMap = Record<string, string>

function emptyFoot(): StrMap {
  return Object.fromEntries(FOOT_FIELDS.map((f) => [f.id, '']))
}

function ViewportFallback({ label }: { label: string }) {
  return (
    <div className="flex h-full w-full items-center justify-center text-[13px] text-foreground/50">
      {label}
    </div>
  )
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <section className="rounded-[20px] bg-surface p-6 shadow-[0_14px_34px_-18px_rgba(0,0,0,.35)]">
      {children}
    </section>
  )
}

function Field({
  label,
  suffix,
  children,
}: {
  label: string
  suffix?: string
  children: React.ReactNode
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[13px] text-foreground/80 max-[640px]:text-[15px]">
        {label}
        {suffix ? <span className="text-foreground/50"> ({suffix})</span> : null}
      </span>
      {children}
    </label>
  )
}

export default function MeasurementsPage() {
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [reducedMotion, setReducedMotion] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )

  const [unit, setUnit] = useState<Unit>('metric')
  const [body, setBody] = useState<StrMap>(() =>
    Object.fromEntries(BODY_FIELDS.map((f) => [f.id, '']))
  )
  const [sizes, setSizes] = useState<Record<SizeId, string>>({
    shirt_size: '',
    pants_size: '',
    ring_size: '',
  })
  const [feet, setFeet] = useState<Record<Side, StrMap>>({ left: emptyFoot(), right: emptyFoot() })
  const [shoe, setShoe] = useState<Record<ShoeSystem, string>>({ eu: '', us: '', jpn: '' })
  const [footSide, setFootSide] = useState<Side>('left')

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = () => setReducedMotion(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

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
          setError('You must be signed in to view this page.')
          setLoading(false)
        }
        return
      }
      if (cancelled) return
      setUserId(user.id)

      const { data } = await supabase
        .from('body_profile')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()

      if (cancelled) return

      const profile = (data ?? null) as BodyProfile | null
      const ext = (profile?.extended ?? {}) as Record<string, unknown>
      const u: Unit = ext.unit === 'imperial' ? 'imperial' : 'metric'
      setUnit(u)

      const nextBody: StrMap = {}
      for (const f of BODY_FIELDS) {
        let metric: number | null = null
        if (f.core) {
          const v = profile ? profile[f.core] : null
          metric = typeof v === 'number' ? v : null
        } else if (f.ext) {
          const v = ext[f.ext]
          metric = typeof v === 'number' ? v : null
        }
        nextBody[f.id] = metric == null ? '' : formatDisplay(metric, f.dim, u)
      }
      setBody(nextBody)

      setSizes({
        shirt_size: typeof ext.shirt_size === 'string' ? ext.shirt_size : '',
        pants_size: typeof ext.pants_size === 'string' ? ext.pants_size : '',
        ring_size: typeof ext.ring_size === 'string' ? ext.ring_size : '',
      })

      setShoe({
        eu: typeof ext.shoe_eu === 'string' ? ext.shoe_eu : '',
        us: typeof ext.shoe_us === 'string' ? ext.shoe_us : '',
        jpn: typeof ext.shoe_jpn === 'string' ? ext.shoe_jpn : '',
      })

      const feetSrc = (ext.feet ?? {}) as Record<string, Record<string, unknown>>
      const nextFeet: Record<Side, StrMap> = { left: emptyFoot(), right: emptyFoot() }
      for (const side of ['left', 'right'] as Side[]) {
        const src = feetSrc[side] ?? {}
        for (const f of FOOT_FIELDS) {
          const v = src[f.id]
          nextFeet[side][f.id] = typeof v === 'number' ? formatDisplay(v, 'len_mm', u) : ''
        }
      }
      setFeet(nextFeet)

      setLoading(false)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  function touched() {
    setSaved(false)
  }

  // Toggle units: re-express every numeric display string in the new unit.
  function switchUnit(next: Unit) {
    if (next === unit) return
    const convert = (str: string, dim: Dim) => {
      const n = parseFloat(str)
      if (!Number.isFinite(n)) return str
      const metric = metricFromDisplay(n, dim, unit)
      return formatDisplay(metric, dim, next)
    }
    setBody((prev) => {
      const out: StrMap = {}
      for (const f of BODY_FIELDS) out[f.id] = convert(prev[f.id], f.dim)
      return out
    })
    setFeet((prev) => {
      const map = (m: StrMap) => {
        const out: StrMap = {}
        for (const f of FOOT_FIELDS) out[f.id] = convert(m[f.id], 'len_mm')
        return out
      }
      return { left: map(prev.left), right: map(prev.right) }
    })
    setUnit(next)
    touched()
  }

  // metric number for a body field (for the 3D avatar + BMI), 0 when unset.
  function metricOf(id: BodyFieldId): number {
    const f = BODY_FIELDS.find((x) => x.id === id)!
    const n = parseFloat(body[id])
    if (!Number.isFinite(n)) return 0
    return metricFromDisplay(n, f.dim, unit)
  }

  const bodyDims: BodyDims = useMemo(
    () => ({
      height_cm: metricOf('height') || 175,
      chest_cm: metricOf('chest') || 98,
      shoulder_cm: metricOf('shoulder') || 46,
      waist_cm: metricOf('waist') || 82,
      hips_cm: metricOf('hips') || 96,
      inseam_cm: metricOf('inseam') || 0,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [body, unit]
  )

  const footDims: FootDims = useMemo(() => {
    const src = feet[footSide]
    const mm = (id: keyof FootDims) => {
      const n = parseFloat(src[id])
      if (!Number.isFinite(n)) return 0
      return metricFromDisplay(n, 'len_mm', unit)
    }
    return {
      foot_length_mm: mm('foot_length_mm'),
      foot_breadth_mm: mm('foot_breadth_mm'),
      ball_girth_mm: mm('ball_girth_mm'),
      heel_breadth_mm: mm('heel_breadth_mm'),
      arch_height_mm: mm('arch_height_mm'),
      instep_height_mm: mm('instep_height_mm'),
    }
  }, [feet, footSide, unit])

  const bmiValue = useMemo(() => bmi(metricOf('height'), metricOf('weight')), [body, unit]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleShoeChange(system: ShoeSystem, value: string) {
    touched()
    const n = parseFloat(value)
    const row = nearestShoeRow(n, system)
    if (row) {
      setShoe({ eu: String(row.eu), us: String(row.us), jpn: String(row.jpn) })
    } else {
      setShoe((prev) => ({ ...prev, [system]: value }))
    }
  }

  async function handleSave() {
    if (!userId) return
    setSaving(true)
    setError(null)
    setSaved(false)

    const round = (dim: Dim, n: number) =>
      dim === 'len_mm' || dim === 'circ_mm' ? Math.round(n) : Math.round(n * 10) / 10

    const toMetric = (str: string, dim: Dim): number | null => {
      const n = parseFloat(str)
      if (!Number.isFinite(n)) return null
      return round(dim, metricFromDisplay(n, dim, unit))
    }

    const bodyMetric = {} as Record<BodyFieldId, number | null>
    for (const f of BODY_FIELDS) bodyMetric[f.id] = toMetric(body[f.id], f.dim)

    const feetMetric = (side: Side) => {
      const out: Record<string, number | null> = {}
      for (const f of FOOT_FIELDS) out[f.id] = toMetric(feet[side][f.id], 'len_mm')
      return out
    }
    const leftFeet = feetMetric('left')
    const rightFeet = feetMetric('right')

    // The core foot_length_cm column tracks the left foot so size recommendations
    // keep working off a single canonical value.
    const leftLenMm = leftFeet.foot_length_mm
    const footLengthCm = leftLenMm == null ? null : Math.round(leftLenMm / 10 * 10) / 10

    const core = {
      height_cm: bodyMetric.height,
      weight_kg: bodyMetric.weight,
      chest_cm: bodyMetric.chest,
      waist_cm: bodyMetric.waist,
      hips_cm: bodyMetric.hips,
      inseam_cm: bodyMetric.inseam,
      shoulder_cm: bodyMetric.shoulder,
      foot_length_cm: footLengthCm,
    }

    const extended = {
      unit,
      sleeve_cm: bodyMetric.sleeve,
      leg_length_cm: bodyMetric.leg,
      thumb_circ_mm: bodyMetric.thumb,
      finger_circ_mm: bodyMetric.finger,
      shirt_size: sizes.shirt_size.trim() || null,
      pants_size: sizes.pants_size.trim() || null,
      ring_size: sizes.ring_size.trim() || null,
      shoe_eu: shoe.eu.trim() || null,
      shoe_us: shoe.us.trim() || null,
      shoe_jpn: shoe.jpn.trim() || null,
      feet: { left: leftFeet, right: rightFeet },
    }

    const supabase = createBrowserSupabase()
    const { error: saveError } = await supabase
      .from('body_profile')
      .upsert({ user_id: userId, ...core, extended })

    setSaving(false)
    if (saveError) {
      setError(saveError.message)
      return
    }
    setSaved(true)
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 lg:px-8">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Measurements</h1>
          <p className="mt-1 text-[13px] text-foreground/60">
            Your sizing profile, with a parametric 3D preview. The models are generated
            geometry that responds to your inputs, not a real body scan.
          </p>
        </div>

        <div
          role="group"
          aria-label="Units"
          className="inline-flex shrink-0 gap-1 rounded-[12px] bg-surface p-1"
        >
          {(['metric', 'imperial'] as Unit[]).map((u) => (
            <button
              key={u}
              type="button"
              onClick={() => switchUnit(u)}
              aria-pressed={unit === u}
              className={`rounded-[9px] px-4 py-2 text-[13px] font-medium capitalize ${
                unit === u ? 'bg-white text-black' : 'hoppable'
              }`}
            >
              {u}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-foreground/60">Loading...</p>
      ) : (
        <div className="flex flex-col gap-6">
          {/* Body ------------------------------------------------------------ */}
          <Card>
            <h2 className="mb-4 text-base font-semibold tracking-tight text-foreground">Body</h2>

            <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
              <div className="h-[380px] overflow-hidden rounded-[16px] bg-background">
                <BodyAvatar dims={bodyDims} reducedMotion={reducedMotion} />
              </div>

              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {BODY_FIELDS.map((f) => (
                    <Field key={f.id} label={f.label} suffix={unitLabel(f.dim, unit)}>
                      <input
                        type="number"
                        inputMode="decimal"
                        step="0.1"
                        min={0}
                        value={body[f.id]}
                        onChange={(e) => {
                          touched()
                          setBody((prev) => ({ ...prev, [f.id]: e.target.value }))
                        }}
                        placeholder="Not set"
                        className={inputClass}
                      />
                    </Field>
                  ))}

                  <Field label="BMI" suffix="auto">
                    <input
                      type="text"
                      readOnly
                      value={bmiValue == null ? '' : bmiValue.toFixed(1)}
                      placeholder="Height + weight"
                      className={`${inputClass} cursor-default opacity-70`}
                    />
                  </Field>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  {SIZE_FIELDS.map((f) => (
                    <Field key={f.id} label={f.label}>
                      <input
                        type="text"
                        value={sizes[f.id]}
                        onChange={(e) => {
                          touched()
                          setSizes((prev) => ({ ...prev, [f.id]: e.target.value }))
                        }}
                        placeholder={f.placeholder}
                        className={inputClass}
                      />
                    </Field>
                  ))}
                </div>
              </div>
            </div>
          </Card>

          {/* Feet ------------------------------------------------------------ */}
          <Card>
            <div className="mb-4 flex items-center justify-between gap-4">
              <h2 className="text-base font-semibold tracking-tight text-foreground">Feet</h2>
              <div
                role="group"
                aria-label="Foot to preview"
                className="inline-flex gap-1 rounded-[12px] bg-background p-1"
              >
                {(['left', 'right'] as Side[]).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setFootSide(s)}
                    aria-pressed={footSide === s}
                    className={`rounded-[9px] px-3.5 py-1.5 text-[13px] font-medium capitalize ${
                      footSide === s ? 'bg-white text-black' : 'hoppable'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
              <div className="flex flex-col gap-2">
                <div className="h-[300px] overflow-hidden rounded-[16px] bg-background">
                  <FootModel dims={footDims} side={footSide} reducedMotion={reducedMotion} />
                </div>
                <p className="text-center text-[12px] text-foreground/50 capitalize">
                  {footSide} foot
                </p>
              </div>

              <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                {(['left', 'right'] as Side[]).map((side) => (
                  <div key={side} className="flex flex-col gap-3">
                    <button
                      type="button"
                      onClick={() => setFootSide(side)}
                      className={`text-left text-[13px] font-medium capitalize ${
                        footSide === side ? 'text-foreground' : 'text-foreground/50'
                      }`}
                    >
                      {side} foot
                    </button>
                    {FOOT_FIELDS.map((f) => (
                      <Field key={f.id} label={f.label} suffix={unitLabel('len_mm', unit)}>
                        <input
                          type="number"
                          inputMode="decimal"
                          step="0.1"
                          min={0}
                          value={feet[side][f.id]}
                          onChange={(e) => {
                            touched()
                            setFeet((prev) => ({
                              ...prev,
                              [side]: { ...prev[side], [f.id]: e.target.value },
                            }))
                          }}
                          placeholder="Not set"
                          className={inputClass}
                        />
                      </Field>
                    ))}
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 border-t border-white/5 pt-6">
              <h3 className="mb-3 text-[13px] font-medium text-foreground/80">
                Default shoe size
              </h3>
              <div className="grid grid-cols-3 gap-4 sm:max-w-md">
                {SHOE_FIELDS.map((f) => (
                  <Field key={f.id} label={f.label}>
                    <input
                      type="number"
                      inputMode="decimal"
                      step="0.5"
                      min={0}
                      value={shoe[f.id]}
                      onChange={(e) => handleShoeChange(f.id, e.target.value)}
                      placeholder="Set"
                      className={inputClass}
                    />
                  </Field>
                ))}
              </div>
              <p className="mt-2 text-[12px] text-foreground/50">
                Editing one size fills the other two from a standard men&apos;s chart.
              </p>
            </div>
          </Card>

          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}
          {saved && !error && (
            <p role="status" className="text-sm text-success">
              Saved.
            </p>
          )}

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="hoppable hoppable-strong self-start rounded-[10px] px-6 py-3 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save measurements'}
          </button>
        </div>
      )}
    </div>
  )
}
