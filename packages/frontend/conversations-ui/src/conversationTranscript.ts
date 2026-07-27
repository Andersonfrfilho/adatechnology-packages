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
    const stamp = new Date(message.timestamp).toLocaleString('pt-BR')
    const author = message.agentName ?? SENDER_LABEL[message.sender]
    // Mídia sem legenda não tem texto nenhum; marcar o tipo evita uma linha vazia sem explicação.
    const body = message.content ?? message.caption ?? `<${message.type}>`
    return `[${stamp}] ${author}: ${body}`
  })

  return [...header, ...lines].join('\n')
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
