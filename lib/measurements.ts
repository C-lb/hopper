// lib/measurements.ts
// Unit conversion + size helpers for the Measurements tab. Canonical values are
// stored in metric (cm, kg, mm); everything here converts for display and back.

export type Unit = 'metric' | 'imperial'

// A field's physical dimension decides how it converts and what unit label it shows.
//   len_cm  -> stored cm,  imperial shows inches
//   mass    -> stored kg,  imperial shows pounds
//   len_mm  -> stored mm,  imperial shows inches  (foot dims)
//   circ_mm -> stored mm,  imperial shows inches  (finger/thumb girth)
export type Dim = 'len_cm' | 'mass' | 'len_mm' | 'circ_mm'

const CM_PER_IN = 2.54
const LB_PER_KG = 2.20462
const MM_PER_IN = 25.4

export function unitLabel(dim: Dim, unit: Unit): string {
  if (unit === 'metric') {
    return dim === 'mass' ? 'kg' : dim === 'len_cm' ? 'cm' : 'mm'
  }
  return dim === 'mass' ? 'lb' : 'in'
}

// Metric number -> displayed number in the chosen unit.
export function displayFromMetric(metric: number, dim: Dim, unit: Unit): number {
  if (unit === 'metric') return metric
  switch (dim) {
    case 'len_cm':
      return metric / CM_PER_IN
    case 'mass':
      return metric * LB_PER_KG
    case 'len_mm':
    case 'circ_mm':
      return metric / MM_PER_IN
  }
}

// Displayed number in the chosen unit -> metric number to store.
export function metricFromDisplay(display: number, dim: Dim, unit: Unit): number {
  if (unit === 'metric') return display
  switch (dim) {
    case 'len_cm':
      return display * CM_PER_IN
    case 'mass':
      return display / LB_PER_KG
    case 'len_mm':
    case 'circ_mm':
      return display * MM_PER_IN
  }
}

// How many decimals to show when converting, per dimension + unit.
export function displayDecimals(dim: Dim, unit: Unit): number {
  if (unit === 'metric') return dim === 'len_mm' || dim === 'circ_mm' ? 0 : 1
  return dim === 'mass' ? 1 : 2
}

// Round a display number to its natural precision and stringify (no trailing zero noise).
export function formatDisplay(metric: number, dim: Dim, unit: Unit): string {
  const n = displayFromMetric(metric, dim, unit)
  const dp = displayDecimals(dim, unit)
  return Number(n.toFixed(dp)).toString()
}

export function bmi(heightCm: number, weightKg: number): number | null {
  if (!heightCm || !weightKg) return null
  const m = heightCm / 100
  return weightKg / (m * m)
}

// ---------------------------------------------------------------------------
// Men's shoe size chart. EU/US/JPN are an approximate standard men's mapping
// (Nike/Adidas-style; JPN is the foot length in cm). Editing any one field
// snaps to the nearest row and fills the other two. Precise conversions differ
// by brand, so treat these as a sensible default, not gospel.
// ---------------------------------------------------------------------------
export interface ShoeRow {
  us: number
  eu: number
  jpn: number
}

export const SHOE_CHART: ShoeRow[] = [
  { us: 6, eu: 38.5, jpn: 24 },
  { us: 6.5, eu: 39, jpn: 24.5 },
  { us: 7, eu: 40, jpn: 25 },
  { us: 7.5, eu: 40.5, jpn: 25.5 },
  { us: 8, eu: 41, jpn: 26 },
  { us: 8.5, eu: 42, jpn: 26.5 },
  { us: 9, eu: 42.5, jpn: 27 },
  { us: 9.5, eu: 43, jpn: 27.5 },
  { us: 10, eu: 44, jpn: 28 },
  { us: 10.5, eu: 44.5, jpn: 28.5 },
  { us: 11, eu: 45, jpn: 29 },
  { us: 11.5, eu: 45.5, jpn: 29.5 },
  { us: 12, eu: 46, jpn: 30 },
  { us: 13, eu: 47.5, jpn: 31 },
]

export type ShoeSystem = 'us' | 'eu' | 'jpn'

// Given a value typed into one system, return the nearest chart row (all three
// systems). Returns null if the value isn't a finite number.
export function nearestShoeRow(value: number, system: ShoeSystem): ShoeRow | null {
  if (!Number.isFinite(value)) return null
  let best = SHOE_CHART[0]
  let bestDelta = Infinity
  for (const row of SHOE_CHART) {
    const delta = Math.abs(row[system] - value)
    if (delta < bestDelta) {
      bestDelta = delta
      best = row
    }
  }
  return best
}
