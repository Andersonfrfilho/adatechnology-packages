import { describe, expect, it } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'

import { AudioTranscription } from './AudioTranscription'
import type { MessageTranscription } from './types'

function render(props: {
  transcription?: MessageTranscription | null
  onTranscribe?: () => Promise<void>
}): string {
  return renderToStaticMarkup(<AudioTranscription {...props} />)
}

const noop = async () => undefined

describe('AudioTranscription', () => {
  it('mostra o texto e oferece copiar', () => {
    const markup = render({ transcription: { status: 'done', text: 'quero dois pães na chapa' } })

    expect(markup).toContain('quero dois pães na chapa')
    expect(markup).toContain('Copiar')
  })

  it('deixa o texto selecionável — é o caminho de quem não tem clipboard disponível', () => {
    const markup = render({ transcription: { status: 'done', text: 'oi' } })

    expect(markup).toContain('select-all')
  })

  it('não oferece copiar quando não há texto para copiar', () => {
    const markup = render({ transcription: { status: 'done', text: '' } })

    expect(markup).not.toContain('Copiar')
  })

  // Silêncio processado é diferente de não transcrito: sem essa distinção o operador clica em
  // transcrever de novo atrás de um texto que não existe.
  it('diz "sem fala detectada" em áudio processado e vazio, sem oferecer transcrever', () => {
    const markup = render({ transcription: { status: 'done', text: '   ' } })

    expect(markup).toContain('Sem fala detectada')
    expect(markup).not.toContain('Transcrever áudio')
  })

  it('oferece transcrever quando nada foi avaliado ainda', () => {
    const markup = render({ transcription: null, onTranscribe: noop })

    expect(markup).toContain('Transcrever áudio')
  })

  // Mesmo padrão de takeover/release: sem a porta, a afordância não existe — melhor que um botão
  // que estoura no clique.
  it('não desenha nada quando não há transcrição nem forma de pedir uma', () => {
    expect(render({ transcription: null })).toBe('')
    expect(render({})).toBe('')
  })

  it('mostra falha com convite a tentar de novo', () => {
    const markup = render({ transcription: { status: 'failed' }, onTranscribe: noop })

    expect(markup).toContain('Falha ao transcrever')
  })

  it('trata pendente como em andamento — já foi tentado e vai sair', () => {
    const markup = render({ transcription: { status: 'pending' }, onTranscribe: noop })

    expect(markup).toContain('Transcrevendo...')
  })

  it('avisa formato não suportado sem oferecer retry — retentar não conserta codec', () => {
    const markup = render({ transcription: { status: 'unsupported' }, onTranscribe: noop })

    expect(markup).toContain('não suportado')
    expect(markup).not.toContain('Transcrever novamente')
  })

  /**
   * Medido: 1147 caracteres produziram uma bolha de 854px, mais alta que a área visível da conversa.
   * Sem o recolhimento, uma nota de voz longa esconde as mensagens seguintes.
   */
  it('recolhe transcrição longa e oferece ver o texto completo', () => {
    const markup = render({ transcription: { status: 'done', text: 'palavra '.repeat(60).trim() } })

    expect(markup).toContain('ver transcrição completa')
    expect(markup).toContain('-webkit-line-clamp')
  })

  it('não recolhe transcrição curta', () => {
    const markup = render({ transcription: { status: 'done', text: 'quero dois pães' } })

    expect(markup).not.toContain('ver transcrição completa')
    expect(markup).not.toContain('-webkit-line-clamp')
  })

  // Recolher é sobre altura na tela; o operador cola o pedido inteiro no sistema interno.
  it('mantém o texto inteiro no DOM mesmo recolhido, para o copiar levar tudo', () => {
    const markup = render({ transcription: { status: 'done', text: 'primeira ' + 'meio '.repeat(70) + 'ultima' } })

    expect(markup).toContain('primeira')
    expect(markup).toContain('ultima')
  })

  it('oferece retranscrever quando já há texto e o host sabe transcrever', () => {
    const markup = render({ transcription: { status: 'done', text: 'ruim' }, onTranscribe: noop })

    expect(markup).toContain('Transcrever novamente')
  })

  it('não oferece retranscrever quando o host não sabe transcrever', () => {
    const markup = render({ transcription: { status: 'done', text: 'ok' } })

    expect(markup).toContain('ok')
    expect(markup).not.toContain('Transcrever novamente')
  })
})
