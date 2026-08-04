import { describe, expect, it } from 'bun:test'
import { buildTranscriptFilename, buildTranscriptText } from './conversationTranscript'
import type { MessagePayload } from './types'

const NUMBER = '5511988887777'

function message(partial: Partial<MessagePayload>): MessagePayload {
  return {
    id: 'm1',
    type: 'text',
    direction: 'inbound',
    sender: 'customer',
    timestamp: '2026-07-27T12:00:00.000Z',
    ...partial,
  }
}

describe('buildTranscriptText', () => {
  it('escreve cabeçalho e uma linha por mensagem', () => {
    const text = buildTranscriptText({
      messages: [
        message({ id: 'm1', content: 'oi' }),
        message({ id: 'm2', content: 'Olá!', direction: 'outbound', sender: 'bot' }),
      ],
      whatsappNumber: NUMBER,
      clientName: 'Marina',
    })

    expect(text).toContain('Conversa: Marina')
    expect(text).toContain(`Número: ${NUMBER}`)
    expect(text).toContain('Mensagens: 2')
    expect(text).toContain('Cliente: oi')
    expect(text).toContain('Bot: Olá!')
  })

  // Sem isto a linha sairia vazia e o histórico esconderia que houve um anexo ali.
  it('marca o tipo quando a mensagem não tem texto', () => {
    const text = buildTranscriptText({ messages: [message({ type: 'audio' })], whatsappNumber: NUMBER })

    expect(text).toContain('<audio>')
  })

  it('usa o nome do atendente quando existe, em vez do papel genérico', () => {
    const text = buildTranscriptText({
      messages: [message({ direction: 'outbound', sender: 'agent', agentName: 'Ana', content: 'já separei' })],
      whatsappNumber: NUMBER,
    })

    expect(text).toContain('Ana: já separei')
  })

  it('cai no número quando não há nome do cliente', () => {
    const text = buildTranscriptText({ messages: [], whatsappNumber: NUMBER })

    expect(text).toContain(`Conversa: ${NUMBER}`)
  })
})

describe('buildTranscriptFilename', () => {
  it('inclui número e data', () => {
    expect(buildTranscriptFilename(NUMBER, new Date('2026-07-27T23:00:00.000Z'))).toBe(
      `conversa-${NUMBER}-2026-07-27.txt`,
    )
  })

  /**
   * O áudio saía como `<audio>` no arquivo baixado. Um histórico onde o pedido do cliente aparece
   * como marcador vazio é inútil justamente para o caso que motiva o download: auditoria e repasse.
   */
  it('escreve a transcrição do áudio no lugar do marcador de tipo', () => {
    const texto = buildTranscriptText({
      whatsappNumber: '5511999999999',
      messages: [
        {
          id: '1',
          type: 'audio',
          direction: 'inbound',
          sender: 'customer',
          timestamp: '2026-07-31T12:00:00.000Z',
          transcription: { status: 'done', text: 'quero dois quilos de arroz' },
        },
      ],
    })

    expect(texto).toContain('[áudio] quero dois quilos de arroz')
    expect(texto).not.toContain('<audio>')
  })

  it('mantém o marcador de tipo quando o áudio não foi transcrito', () => {
    const texto = buildTranscriptText({
      whatsappNumber: '5511999999999',
      messages: [
        { id: '1', type: 'audio', direction: 'inbound', sender: 'customer', timestamp: '2026-07-31T12:00:00.000Z' },
      ],
    })

    expect(texto).toContain('<audio>')
  })

  /**
   * A rota de export do módulo devolve `createdAt`, não `sentAt` — quem mapeia esperando `sentAt`
   * entrega `undefined` aqui, e o arquivo saía com "Invalid Date" em todas as linhas.
   */
  it('escreve "data indisponível" em vez de Invalid Date quando o horário não vem', () => {
    const texto = buildTranscriptText({
      whatsappNumber: '5511999999999',
      messages: [
        {
          id: '1',
          type: 'text',
          direction: 'inbound',
          sender: 'customer',
          content: 'ola',
          timestamp: undefined as unknown as string,
        },
      ],
    })

    expect(texto).toContain('data indisponível')
    expect(texto).not.toContain('Invalid Date')
  })
})
