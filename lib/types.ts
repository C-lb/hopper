export type Condition = 'new' | 'like-new' | 'used' | 'refurbished'

export interface BodyProfile {
  user_id: string
  height_cm: number | null; weight_kg: number | null
  chest_cm: number | null; waist_cm: number | null; hips_cm: number | null
  inseam_cm: number | null; shoulder_cm: number | null; foot_length_cm: number | null
  notes: string | null; updated_at: string
}

export interface Purchase {
  id: string; user_id: string
  item_name: string; brand: string | null; category: string | null
  condition: Condition; size: string | null
  purchased_at: string
  price_amount: number; price_currency: string
  display_currency: string | null; fx_rate: number | null
  fx_rate_date: string | null; converted_amount: number | null
  location_name: string | null; location_lat: number | null; location_lng: number | null
  photo_url: string | null
  msrp_amount: number | null; msrp_currency: string | null
  savings_amount: number | null; savings_currency: string | null
  recommended_size: string | null; recommended_size_rationale: string | null
  source_url: string | null; notes: string | null
  created_at: string; updated_at: string
}
