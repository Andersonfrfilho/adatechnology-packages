/**
 * Serialização do transcript para download. Fica no pacote porque o formato de um histórico de
 * WhatsApp legível não é regra de negócio de ninguém — e porque o host que já tem as mensagens em
 * tela não deveria precisar de rota nova só para salvar um arquivo.
 *
 * Funções puras, separadas do disparo do download: é o que permite testá-las sem DOM.
 */

import type { MessagePayload } from './types'

const SENDER_LABEL: Record<MessagePayload['sender'], string> = {
  customer: 'Cliente',
  bot: 'Bot',
  agent: 'Atendente',
}

export type BuildTranscriptTextParams = {
  readonly messages: readonly MessagePayload[]
  readonly whatsappNumber: string
  readonly clientName?: string | undefined
}

/**
 * Formato próximo ao export nativo do WhatsApp (`[data hora] Autor: texto`), que é o que pessoas e
 * ferramentas de suporte já sabem ler.
 */
export function buildTranscriptText(params: BuildTranscriptTextParams): string {
  const header = [
    `Conversa: ${params.clientName ?? params.whatsappNumber}`,
    `Número: ${params.whatsappNumber}`,
    `Mensagens: ${params.messages.length}`,
    '',
  ]

  const lines = params.messages.map((message) => {
    const author = message.agentName ?? SENDER_LABEL[message.sender]
    return `[${formatStamp(message.timestamp)}] ${author}: ${bodyOf(message)}`
  })

  return [...header, ...lines].join('\n')
}

/**
 * Corpo da linha no arquivo.
 *
 * Áudio transcrito entra com o TEXTO, não como `<audio>`. Quem baixa a conversa quer lê-la, e um
 * histórico onde o pedido do cliente aparece como marcador vazio é inútil justamente para o caso que
 * motiva o download: auditoria e repasse. O prefixo `[áudio]` fica na frente para a linha não passar
 * por mensagem digitada — quem audita precisa saber que aquilo foi falado e transcrito por máquina.
 */
function bodyOf(message: MessagePayload): string {
  const transcript = message.transcription?.text?.trim()
  if (message.type === 'audio' && transcript) return `[áudio] ${transcript}`

  // Mídia sem legenda não tem texto nenhum; marcar o tipo evita uma linha vazia sem explicação.
  return message.content ?? message.caption ?? `<${message.type}>`
}

/**
 * `Invalid Date` no arquivo é pior do que data ausente: parece dado corrompido e põe em dúvida o
 * resto do transcript. E acontece de verdade — a rota de export do módulo devolve `createdAt`, não
 * `sentAt`, então quem mapeia esperando `sentAt` recebe `undefined` aqui.
 */
function formatStamp(timestamp: string | undefined): string {
  if (!timestamp) return 'data indisponível'

  const parsed = new Date(timestamp)
  return Number.isNaN(parsed.getTime()) ? 'data indisponível' : parsed.toLocaleString('pt-BR')
}

export function buildTranscriptFilename(whatsappNumber: string, generatedAt: Date): string {
  const stamp = generatedAt.toISOString().slice(0, 10)
  return `conversa-${whatsappNumber}-${stamp}.txt`
}

/**
 * Dispara o download no navegador. `revokeObjectURL` no fim não é higiene opcional: sem ele cada
 * export retém o blob inteiro em memória até a aba fechar.
 */
export function downloadTextFile(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')

  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}
