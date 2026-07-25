import { z } from 'zod'
import { WhatsAppUnexpectedResponseError } from '../errors/WhatsAppError'

export const idResponseSchema = z.object({ id: z.string() })

export const catalogListResponseSchema = z.object({
  data: z.array(z.object({ id: z.string(), name: z.string() })),
})

export const productDetailResponseSchema = z.object({
  id: z.string(),
  retailer_id: z.string(),
  name: z.string(),
  description: z.string().optional().default(''),
  price: z.number(),
  currency: z.string(),
  image_url: z.string().optional().default(''),
  availability: z.enum(['in stock', 'out of stock', 'preorder', 'available for order', 'discontinued']),
  condition: z.enum(['new', 'refurbished', 'used']),
  url: z.string().optional(),
  custom_label_0: z.string().optional().default(''),
})

export function parseGraphResponse<TSchema extends z.ZodTypeAny>(schema: TSchema, raw: unknown): z.infer<TSchema> {
  const result = schema.safeParse(raw)
  if (!result.success) {
    throw new WhatsAppUnexpectedResponseError(result.error.message, raw)
  }
  return result.data
}
