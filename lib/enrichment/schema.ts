import { z } from 'zod'
export const ExtractionSchema = z.object({
  photo_url: z.string().url().nullable().default(null),
  msrp: z.object({ amount: z.number(), currency: z.string().length(3) }).nullable().default(null),
  size_chart: z.string().nullable().default(null),
  source_url: z.string().url().nullable().default(null),
})
export const RecommendationSchema = z.object({
  recommended_size: z.string(), rationale: z.string(),
})
export type ExtractionResult = z.infer<typeof ExtractionSchema>
export function safeExtract(json: unknown): ExtractionResult | null {
  const r = ExtractionSchema.safeParse(json ?? {})
  return r.success ? r.data : null
}
