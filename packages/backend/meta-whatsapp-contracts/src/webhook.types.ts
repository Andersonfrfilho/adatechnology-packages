import { z } from 'zod'

// Extraído de financiamento-imobiliario-bot/apps/api/src/modules/webhook/application/use-cases/
// ReceiveWhatsAppWebhook.use-case.ts:39-113 — shape real do payload da Cloud API da Meta.

export const whatsAppMediaSchema = z.object({
  id: z.string(),
  mime_type: z.string(),
  sha256: z.string().optional(),
  caption: z.string().optional(),
  filename: z.string().optional(),
})
export type WhatsAppMedia = z.infer<typeof whatsAppMediaSchema>

export const whatsAppInteractiveSchema = z.object({
  type: z.string(),
  button_reply: z.object({ id: z.string(), title: z.string() }).optional(),
  list_reply: z.object({ id: z.string(), title: z.string() }).optional(),
})
export type WhatsAppInteractive = z.infer<typeof whatsAppInteractiveSchema>

export const whatsAppOrderSchema = z.object({
  catalog_id: z.string(),
  text: z.string().optional(),
  product_items: z.array(
    z.object({
      product_retailer_id: z.string(),
      quantity: z.number(),
      item_price: z.number(),
      currency: z.string(),
    }),
  ),
})
export type WhatsAppOrder = z.infer<typeof whatsAppOrderSchema>

export const whatsAppMessageSchema = z.object({
  id: z.string(),
  from: z.string(),
  type: z.string(),
  text: z.object({ body: z.string() }).optional(),
  image: whatsAppMediaSchema.optional(),
  audio: whatsAppMediaSchema.optional(),
  video: whatsAppMediaSchema.optional(),
  document: whatsAppMediaSchema.optional(),
  sticker: whatsAppMediaSchema.optional(),
  interactive: whatsAppInteractiveSchema.optional(),
  // Pedido enviado pelo carrinho do catálogo (WhatsApp Commerce)
  order: whatsAppOrderSchema.optional(),
  // Presente quando o cliente abre um item do catálogo e manda mensagem pela página do produto
  context: z
    .object({
      from: z.string().optional(),
      id: z.string().optional(),
      referred_product: z.object({ catalog_id: z.string(), product_retailer_id: z.string() }).optional(),
    })
    .optional(),
  timestamp: z.string(),
})
export type WhatsAppMessage = z.infer<typeof whatsAppMessageSchema>

export const whatsAppMessageEchoSchema = z.object({
  id: z.string(),
  from: z.string(),
  timestamp: z.string(),
  type: z.string(),
})
export type WhatsAppMessageEcho = z.infer<typeof whatsAppMessageEchoSchema>

export const whatsAppMessageStatusSchema = z.enum(['sent', 'delivered', 'read', 'failed'])
export type WhatsAppMessageStatusValue = z.infer<typeof whatsAppMessageStatusSchema>

export const whatsAppStatusSchema = z.object({
  id: z.string(),
  status: whatsAppMessageStatusSchema,
  timestamp: z.string(),
  recipient_id: z.string().optional(),
})
export type WhatsAppStatus = z.infer<typeof whatsAppStatusSchema>

export const whatsAppWebhookPayloadSchema = z.object({
  object: z.string(),
  entry: z.array(
    z.object({
      id: z.string(),
      changes: z.array(
        z.object({
          value: z.object({
            messaging_product: z.string(),
            messages: z.array(whatsAppMessageSchema).optional(),
            message_echoes: z.array(whatsAppMessageEchoSchema).optional(),
            statuses: z.array(whatsAppStatusSchema).optional(),
            metadata: z.object({ display_phone_number: z.string(), phone_number_id: z.string() }).optional(),
          }),
        }),
      ),
    }),
  ),
})
export type WhatsAppWebhookPayload = z.infer<typeof whatsAppWebhookPayloadSchema>
