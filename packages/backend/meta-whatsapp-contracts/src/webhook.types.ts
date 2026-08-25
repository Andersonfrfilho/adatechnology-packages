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

// Nome do campo de webhook como a Meta o envia em `changes[].field`. Só os que temos handler.
export const WHATSAPP_WEBHOOK_FIELDS = {
  MESSAGES: 'messages',
  MESSAGE_ECHOES: 'message_echoes',
  TEMPLATE_STATUS_UPDATE: 'message_template_status_update',
  PHONE_NUMBER_QUALITY_UPDATE: 'phone_number_quality_update',
} as const
export type WhatsAppWebhookField = (typeof WHATSAPP_WEBHOOK_FIELDS)[keyof typeof WHATSAPP_WEBHOOK_FIELDS]

// Eventos de nível WABA — não falam de uma conversa, e por isso não trazem `messaging_product`
// nem `metadata`. Chegam na MESMA rota dos eventos de mensagem, distinguidos só pelo `field`.

export const whatsAppTemplateStatusEventSchema = z.enum([
  'APPROVED',
  'REJECTED',
  'PENDING',
  'PAUSED',
  'PENDING_DELETION',
  'DISABLED',
  'FLAGGED',
])
export type WhatsAppTemplateStatusEvent = z.infer<typeof whatsAppTemplateStatusEventSchema>

export const whatsAppTemplateStatusUpdateSchema = z.object({
  event: whatsAppTemplateStatusEventSchema,
  // A Meta manda o id do template como número em alguns eventos e como string em outros; o resto
  // do sistema trata id como string, então normalizamos na fronteira em vez de espalhar `String()`.
  message_template_id: z.union([z.string(), z.number()]).transform((value) => String(value)),
  message_template_name: z.string(),
  message_template_language: z.string(),
  // Só vem em REJECTED/PAUSED/DISABLED, e a Meta às vezes manda `null` em vez de omitir.
  reason: z.string().nullish(),
  disable_date: z.string().optional(),
})
export type WhatsAppTemplateStatusUpdate = z.infer<typeof whatsAppTemplateStatusUpdateSchema>

export const whatsAppQualityEventSchema = z.enum(['FLAGGED', 'UNFLAGGED', 'ONBOARDING', 'UPGRADE', 'DOWNGRADE'])
export type WhatsAppQualityEvent = z.infer<typeof whatsAppQualityEventSchema>

export const whatsAppPhoneNumberQualityUpdateSchema = z.object({
  display_phone_number: z.string(),
  event: whatsAppQualityEventSchema,
  // Tier de envio (`TIER_1K`, `TIER_10K`, …). Ausente em evento que não mexe no limite.
  current_limit: z.string().optional(),
  old_limit: z.string().optional(),
})
export type WhatsAppPhoneNumberQualityUpdate = z.infer<typeof whatsAppPhoneNumberQualityUpdateSchema>

// `value` é permissivo de propósito: um `change` carrega uma forma diferente por `field`, e a Meta
// adiciona campo em versão nova sem aviso. Validar aqui como união fechada faria o webhook inteiro
// (mensagem de cliente inclusive) morrer por causa de um evento administrativo que nem consumimos.
// A validação estrita de cada evento acontece no roteamento, contra o schema do seu próprio field.
export const whatsAppWebhookValueSchema = z
  .object({
    messaging_product: z.string().optional(),
    messages: z.array(whatsAppMessageSchema).optional(),
    message_echoes: z.array(whatsAppMessageEchoSchema).optional(),
    statuses: z.array(whatsAppStatusSchema).optional(),
    metadata: z.object({ display_phone_number: z.string(), phone_number_id: z.string() }).optional(),
  })
  .passthrough()
export type WhatsAppWebhookValue = z.infer<typeof whatsAppWebhookValueSchema>

export const whatsAppWebhookChangeSchema = z.object({
  // Qual assinatura disparou. Opcional porque payload antigo de fixture não tem, e porque a
  // ausência precisa degradar para "trata como mensagem", que é o comportamento histórico.
  field: z.string().optional(),
  value: whatsAppWebhookValueSchema,
})
export type WhatsAppWebhookChange = z.infer<typeof whatsAppWebhookChangeSchema>

export const whatsAppWebhookPayloadSchema = z.object({
  object: z.string(),
  entry: z.array(
    z.object({
      id: z.string(),
      changes: z.array(whatsAppWebhookChangeSchema),
    }),
  ),
})
export type WhatsAppWebhookPayload = z.infer<typeof whatsAppWebhookPayloadSchema>
