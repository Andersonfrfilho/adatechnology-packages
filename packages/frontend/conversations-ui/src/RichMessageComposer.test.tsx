import { describe, expect, it } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'

import { RichMessageComposer, type RichComposerQuickReply, type RichComposerVariable } from './RichMessageComposer'

const noop = () => {}

const QUICK_REPLIES: RichComposerQuickReply[] = [
  { id: 'greeting', label: 'Saudação', text: 'Olá!', tooltip: 'Abre o atendimento' },
]

const VARIABLES: RichComposerVariable[] = [
  { id: 'name', label: 'Nome do cliente', value: '{{nome}}' },
]

describe('RichMessageComposer', () => {
  it('mostra as dicas padrão em todas as ações da barra', () => {
    const markup = renderToStaticMarkup(
      <RichMessageComposer value="" onChange={noop} onSend={noop} onAttachFiles={noop} />,
    )

    for (const tooltip of ['Negrito', 'Itálico', 'Tachado', 'Monoespaçado', 'Anexar arquivo', 'Enviar']) {
      expect(markup).toContain(`data-cv-tooltip="${tooltip}"`)
    }
  })

  it('deixa o host trocar o texto de uma dica sem mexer nas outras', () => {
    const markup = renderToStaticMarkup(
      <RichMessageComposer value="" onChange={noop} onSend={noop} tooltips={{ bold: 'Deixar em negrito' }} />,
    )

    expect(markup).toContain('data-cv-tooltip="Deixar em negrito"')
    expect(markup).not.toContain('data-cv-tooltip="Negrito"')
    expect(markup).toContain('data-cv-tooltip="Itálico"')
  })

  it('esconde só a ação que o host desligou', () => {
    const markup = renderToStaticMarkup(
      <RichMessageComposer value="" onChange={noop} onSend={noop} toolbar={{ monospace: false }} />,
    )

    expect(markup).not.toContain('data-cv-tooltip="Monoespaçado"')
    expect(markup).toContain('data-cv-tooltip="Negrito"')
  })

  it('não desenha o anexo quando não há como anexar', () => {
    const markup = renderToStaticMarkup(<RichMessageComposer value="" onChange={noop} onSend={noop} />)

    expect(markup).not.toContain('data-cv-tooltip="Anexar arquivo"')
  })

  it('desenha os chips de resposta rápida com o rótulo e a dica do host', () => {
    const markup = renderToStaticMarkup(
      <RichMessageComposer value="" onChange={noop} onSend={noop} quickReplies={QUICK_REPLIES} />,
    )

    expect(markup).toContain('Saudação')
    expect(markup).toContain('data-cv-tooltip="Abre o atendimento"')
  })

  it('só oferece variáveis quando o host manda alguma', () => {
    const semVariaveis = renderToStaticMarkup(<RichMessageComposer value="" onChange={noop} onSend={noop} />)
    const comVariaveis = renderToStaticMarkup(
      <RichMessageComposer value="" onChange={noop} onSend={noop} variables={VARIABLES} />,
    )

    expect(semVariaveis).not.toContain('data-cv-tooltip="Variáveis disponíveis"')
    expect(comVariaveis).toContain('data-cv-tooltip="Variáveis disponíveis"')
  })

  it('nasce com toda formatação apagada, e diz isso ao leitor de tela', () => {
    const markup = renderToStaticMarkup(<RichMessageComposer value="" onChange={noop} onSend={noop} />)

    expect(markup).toContain('aria-pressed="false"')
    expect(markup).not.toContain('aria-pressed="true"')
  })

  it('cede o lugar do enviar à ação ociosa enquanto não há texto', () => {
    const vazio = renderToStaticMarkup(
      <RichMessageComposer value="" onChange={noop} onSend={noop} idleAction={<button aria-label="Gravar áudio" />} />,
    )
    const comTexto = renderToStaticMarkup(
      <RichMessageComposer value="oi" onChange={noop} onSend={noop} idleAction={<button aria-label="Gravar áudio" />} />,
    )

    expect(vazio).toContain('aria-label="Gravar áudio"')
    expect(vazio).not.toContain('data-cv-tooltip="Enviar"')
    expect(comTexto).toContain('data-cv-tooltip="Enviar"')
  })

  it('desenha as quatro formatações abertas enquanto a barra não foi medida', () => {
    const markup = renderToStaticMarkup(<RichMessageComposer value="" onChange={noop} onSend={noop} />)

    expect(markup).toContain('data-cv-tooltip="Negrito"')
    // O botão que recolhe as quatro só aparece com a barra medida e estreita.
    expect(markup).not.toContain('data-cv-tooltip="Formatação"')
  })

  it('mostra o enviar com anexo na fila e nenhum texto, senão a imagem fica presa', () => {
    const markup = renderToStaticMarkup(
      <RichMessageComposer
        value=""
        onChange={noop}
        onSend={noop}
        hasQueuedAttachments
        idleAction={<button aria-label="Gravar áudio" />}
      />,
    )

    expect(markup).toContain('data-cv-tooltip="Enviar"')
    expect(markup).not.toContain('aria-label="Gravar áudio"')
  })
})
