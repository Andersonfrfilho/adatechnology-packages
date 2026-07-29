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
      expect(markup).toContain(`title="${tooltip}"`)
    }
  })

  it('deixa o host trocar o texto de uma dica sem mexer nas outras', () => {
    const markup = renderToStaticMarkup(
      <RichMessageComposer value="" onChange={noop} onSend={noop} tooltips={{ bold: 'Deixar em negrito' }} />,
    )

    expect(markup).toContain('title="Deixar em negrito"')
    expect(markup).not.toContain('title="Negrito"')
    expect(markup).toContain('title="Itálico"')
  })

  it('esconde só a ação que o host desligou', () => {
    const markup = renderToStaticMarkup(
      <RichMessageComposer value="" onChange={noop} onSend={noop} toolbar={{ monospace: false }} />,
    )

    expect(markup).not.toContain('title="Monoespaçado"')
    expect(markup).toContain('title="Negrito"')
  })

  it('não desenha o anexo quando não há como anexar', () => {
    const markup = renderToStaticMarkup(<RichMessageComposer value="" onChange={noop} onSend={noop} />)

    expect(markup).not.toContain('title="Anexar arquivo"')
  })

  it('desenha os chips de resposta rápida com o rótulo e a dica do host', () => {
    const markup = renderToStaticMarkup(
      <RichMessageComposer value="" onChange={noop} onSend={noop} quickReplies={QUICK_REPLIES} />,
    )

    expect(markup).toContain('Saudação')
    expect(markup).toContain('title="Abre o atendimento"')
  })

  it('só oferece variáveis quando o host manda alguma', () => {
    const semVariaveis = renderToStaticMarkup(<RichMessageComposer value="" onChange={noop} onSend={noop} />)
    const comVariaveis = renderToStaticMarkup(
      <RichMessageComposer value="" onChange={noop} onSend={noop} variables={VARIABLES} />,
    )

    expect(semVariaveis).not.toContain('title="Variáveis disponíveis"')
    expect(comVariaveis).toContain('title="Variáveis disponíveis"')
  })

  it('cede o lugar do enviar à ação ociosa enquanto não há texto', () => {
    const vazio = renderToStaticMarkup(
      <RichMessageComposer value="" onChange={noop} onSend={noop} idleAction={<button aria-label="Gravar áudio" />} />,
    )
    const comTexto = renderToStaticMarkup(
      <RichMessageComposer value="oi" onChange={noop} onSend={noop} idleAction={<button aria-label="Gravar áudio" />} />,
    )

    expect(vazio).toContain('aria-label="Gravar áudio"')
    expect(vazio).not.toContain('title="Enviar"')
    expect(comTexto).toContain('title="Enviar"')
  })
})
