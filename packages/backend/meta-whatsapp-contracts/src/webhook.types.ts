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

export const whatsAppLocationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  name: z.string().optional(),
  address: z.string().optional(),
  url: z.string().optional(),
})
export type WhatsAppLocation = z.infer<typeof whatsAppLocationSchema>

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
  // Coordenada enviada pelo botão "Localização" do app do cliente
  location: whatsAppLocationSchema.optional(),
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

/**
 * Por que a Meta recusou a entrega. Só existe no webhook de status, e só quando `status` é
 * `failed`.
 *
 * `code` é o que decide: 131030 é número fora da allowlist do ambiente de teste, 131047 é janela
 * de 24h vencida, 130497 é conta barrada de mandar mensagem para o país. São três causas sem nada
 * em comum — allowlist, tempo e restrição de conta — e todas chegam ao cliente como a mesma
 * ausência de resposta. Sem o código, distinguir uma da outra custa uma investigação inteira.
 */
export const whatsAppStatusErrorSchema = z.object({
  code: z.number().optional(),
  title: z.string().optional(),
  message: z.string().optional(),
  href: z.string().optional(),
  error_data: z.object({ details: z.string().optional() }).optional(),
})
export type WhatsAppStatusError = z.infer<typeof whatsAppStatusErrorSchema>

/**
 * `errors` entra no schema porque `z.object` descarta o que não declara: enquanto o campo não
 * existia aqui, o motivo da recusa era apagado na validação e nunca chegava a `onStatusUpdate` —
 * o hook era chamado, mas com o único dado que importa já removido. Quem precisava do motivo
 * tinha de reprocessar o corpo cru do webhook por fora do módulo.
 *
 * Tolerante de propósito: campo que a Meta parar de mandar não pode derrubar a validação do
 * webhook inteiro, porque isso troca um envio sem explicação por todos os eventos perdidos.
 */
export const whatsAppStatusSchema = z.object({
  id: z.string(),
  status: whatsAppMessageStatusSchema,
  timestamp: z.string(),
  recipient_id: z.string().optional(),
  errors: z.array(whatsAppStatusErrorSchema).optional(),
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
/**
 * O contato que a Meta manda junto das mensagens. `profile.name` é o nome que a PESSOA escolheu no
 * WhatsApp dela — é o único nome que existe antes de alguém digitar um, e sem ele o cliente criado
 * por mensagem nasce sem nome nenhum.
 *
 * `profile` é opcional: a pessoa pode não ter nome definido, e a Meta omite o objeto nesse caso.
 */
export const whatsAppContactSchema = z.object({
  wa_id: z.string(),
  profile: z.object({ name: z.string() }).optional(),
})
export type WhatsAppContact = z.infer<typeof whatsAppContactSchema>

export const whatsAppWebhookValueSchema = z
  .object({
    messaging_product: z.string().optional(),
    messages: z.array(whatsAppMessageSchema).optional(),
    contacts: z.array(whatsAppContactSchema).optional(),
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

/**
 * O nome de perfil de quem mandou a mensagem.
 *
 * Casa por `wa_id`. Quando nenhum casa e há UM contato só, é dele: a Meta agrupa as mensagens de um
 * mesmo contato num `change`, e o `wa_id` nem sempre é idêntico ao `from` — no Brasil o nono dígito
 * aparece num e não no outro, e exigir igualdade perderia o nome exatamente nos números móveis.
 *
 * Com dois ou mais contatos sem casamento, devolve `undefined`: pendurar o nome errado numa ficha é
 * pior que ficha sem nome.
 */
export function resolveContactProfileName(params: {
  readonly contacts: readonly WhatsAppContact[] | undefined
  readonly from: string
}): string | undefined {
  const contacts = params.contacts ?? []
  if (contacts.length === 0) return undefined

  const exact = contacts.find((contact) => contact.wa_id === params.from)
  if (exact) return exact.profile?.name

  return contacts.length === 1 ? contacts[0]?.profile?.name : undefined
}
