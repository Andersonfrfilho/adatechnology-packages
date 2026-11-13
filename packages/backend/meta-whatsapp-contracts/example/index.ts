/**
 * Example de uso do @adatechnology/meta-whatsapp-contracts — o pacote não tem runtime próprio
 * (só tipos, schemas zod e interfaces de porta), então este exemplo demonstra as duas coisas
 * que ele realmente entrega: validar um payload real de webhook e implementar as portas que o
 * módulo (Fase 3-5) vai consumir.
 *
 * Rodar: bun run packages/backend/meta-whatsapp-contracts/example/index.ts
 */
import { whatsAppWebhookPayloadSchema, type MetaWhatsAppHooks, type ChannelAdapterInterface } from '../src/index'

// 1. Validar um payload de webhook real (mesmo shape que a Meta envia) — o `safeParse` do zod
//    devolve erro estruturado em vez de deixar um campo inesperado quebrar o handler mais tarde.
const examplePayload = {
  object: 'whatsapp_business_account',
  entry: [
    {
      id: 'entry-1',
      changes: [
        {
          value: {
            messaging_product: 'whatsapp',
            metadata: { display_phone_number: '+55 11 99999-9999', phone_number_id: '1234567890' },
            messages: [
              {
                id: 'wamid.EXAMPLE',
                from: '5511988887777',
                type: 'text',
                text: { body: 'Olá!' },
                timestamp: '1700000000',
              },
            ],
          },
        },
      ],
    },
  ],
}

const parsed = whatsAppWebhookPayloadSchema.safeParse(examplePayload)
if (parsed.success) {
  const message = parsed.data.entry[0]?.changes[0]?.value.messages?.[0]
  console.log('Payload válido — mensagem recebida:', message?.text?.body, 'de', message?.from)
} else {
  console.error('Payload inválido:', parsed.error.message)
}

// 2. Implementar as portas do módulo — este é o ponto de extensão real (ver
//    rules/packages/pluggable-module.md): o host escreve isto, nunca edita o pacote.
const exampleChannelAdapter: ChannelAdapterInterface = {
  async sendText(to, body) {
    console.log(`[mock channel] enviando texto para ${to}: "${body}"`)
    return { externalMessageId: 'mock-id' }
  },
  async sendMedia() {
    return { externalMessageId: 'mock-id' }
  },
  async sendTemplate() {
    return { externalMessageId: 'mock-id' }
  },
  async sendInteractiveList() {
    return { externalMessageId: 'mock-id' }
  },
  async fetchMediaAsBase64() {
    return { data: '', mimeType: 'application/octet-stream' }
  },
}

const exampleHooks: MetaWhatsAppHooks = {
  async onMessageReceived(message, session) {
    console.log(`[hook] mensagem "${message.text?.body ?? message.type}" na sessão ${session.id}`)
    // 'continue' delega ao motor de fluxo do módulo; 'handled' diz que o host já respondeu.
    return { outcome: 'continue' }
  },
}

console.log('\nPortas implementadas com sucesso — prontas para injetar em createMetaWhatsAppModule().')
void exampleChannelAdapter
void exampleHooks
