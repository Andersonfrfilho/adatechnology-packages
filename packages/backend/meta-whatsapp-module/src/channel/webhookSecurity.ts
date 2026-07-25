import { createHmac, timingSafeEqual } from 'node:crypto'
import { InvalidWebhookSignatureError } from '@adatechnology/meta-whatsapp-contracts'

// Porta mínima de armazenamento com TTL para o nonce anti-replay. Qualquer cache do host serve
// (Redis, Memcached); precisa ser COMPARTILHADO entre instâncias — um cache em memória por
// processo deixaria a mesma entrega passar uma vez em cada instância.
export interface NonceStoreInterface {
  // Deve ser atômico (SET NX): devolve true só se a chave ainda não existia. Um get-then-set
  // não serve — duas entregas simultâneas leriam "ausente" e ambas seguiriam.
  setIfAbsent(key: string, ttlSeconds: number): Promise<boolean>
}

export const WEBHOOK_NONCE_TTL_SECONDS = 300

// Comparação em tempo constante entre dois textos. `timingSafeEqual` exige buffers do mesmo
// tamanho, e o próprio comprimento vaza informação — por isso comparamos digests de tamanho
// fixo em vez dos valores crus.
function safeEqualStrings(left: string, right: string): boolean {
  const leftDigest = createHmac('sha256', 'constant-time-compare').update(left).digest()
  const rightDigest = createHmac('sha256', 'constant-time-compare').update(right).digest()
  return timingSafeEqual(leftDigest, rightDigest)
}

// GET /webhook da Meta: ela envia hub.mode/hub.verify_token/hub.challenge e espera o challenge
// de volta em texto puro. Comparação em tempo constante — o verify token é um segredo, e
// comparar com === permitiria descobri-lo caractere a caractere pelo tempo de resposta.
export function verifyWebhookChallenge(params: {
  mode: string | null
  token: string | null
  challenge: string | null
  expectedToken: string
}): string {
  if (params.mode !== 'subscribe' || !params.token || !params.challenge) {
    throw new InvalidWebhookSignatureError()
  }
  if (!safeEqualStrings(params.token, params.expectedToken)) {
    throw new InvalidWebhookSignatureError()
  }
  return params.challenge
}

// POST /webhook: a Meta assina o corpo CRU com o app secret e manda em X-Hub-Signature-256.
// Precisa ser o buffer exato recebido — reserializar o JSON muda espaçamento/ordem e invalida
// a assinatura.
export function verifyWebhookSignature(params: {
  rawBody: Buffer | string
  signatureHeader: string | null | undefined
  appSecret: string
}): void {
  const { rawBody, signatureHeader, appSecret } = params
  if (!signatureHeader?.startsWith('sha256=')) throw new InvalidWebhookSignatureError()

  const expected = createHmac('sha256', appSecret).update(rawBody).digest('hex')
  const received = signatureHeader.slice('sha256='.length)

  // Comprimentos diferentes já reprovam, mas passamos pelo digest de tamanho fixo para não
  // transformar isso num canal de tempo.
  if (!safeEqualStrings(received, expected)) throw new InvalidWebhookSignatureError()
}

// Anti-replay: a mesma entrega assinada, reenviada por um atacante que a capturou, seria aceita
// de novo — a assinatura continua válida. O nonce marca a entrega como já processada por uma
// janela curta. A Meta legitimamente reenvia em caso de timeout, então isto também absorve o
// retry dela sem duplicar efeito.
//
// Devolve false quando a entrega já foi vista (o chamador deve responder 200 e ignorar — a Meta
// desativa webhooks que respondem erro).
export async function claimWebhookDelivery(params: {
  nonceStore: NonceStoreInterface
  signatureHeader: string
  ttlSeconds?: number
}): Promise<boolean> {
  // A assinatura é derivada do corpo, então é única por entrega — não precisamos de um nonce
  // separado, e usá-la evita depender de um campo que a Meta não garante.
  const key = `meta-whatsapp:webhook:${params.signatureHeader}`
  return params.nonceStore.setIfAbsent(key, params.ttlSeconds ?? WEBHOOK_NONCE_TTL_SECONDS)
}
