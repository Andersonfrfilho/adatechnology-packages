import { describe, expect, it } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'

import { FORMATTING_ACTION, WHATSAPP_MARKER_BY_ACTION } from '../lib/composer-formatting'
import { FlowWhatsAppPreview } from '../flows/FlowWhatsAppPreview'
import { DEFAULT_QUICK_REPLIES_WORKSPACE_LABELS } from './labels'
import { QuickRepliesWorkspace } from './QuickRepliesWorkspace'
import { QuickReplyFormattingToolbar } from './QuickReplyFormattingToolbar'
import { QuickReplyWhatsAppPreview, resolvePreviewVariables } from './QuickReplyWhatsAppPreview'
import { wrapSelection } from './useQuickRepliesWorkspace'

const LABELS = DEFAULT_QUICK_REPLIES_WORKSPACE_LABELS

describe('wrapSelection', () => {
  it('envolve a seleção e mantém o trecho selecionado', () => {
    expect(wrapSelection({ text: 'Olá mundo', start: 4, end: 9, marker: '*' })).toEqual({
      text: 'Olá *mundo*',
      selectionStart: 5,
      selectionEnd: 10,
    })
  })

  it('sem seleção, abre o par com o cursor no meio', () => {
    expect(wrapSelection({ text: 'Olá ', start: 4, end: 4, marker: '_' })).toEqual({
      text: 'Olá __',
      selectionStart: 5,
      selectionEnd: 5,
    })
  })

  it.each([
    [FORMATTING_ACTION.BOLD, '*oi*'],
    [FORMATTING_ACTION.ITALIC, '_oi_'],
    [FORMATTING_ACTION.STRIKETHROUGH, '~oi~'],
    [FORMATTING_ACTION.MONOSPACE, '```oi```'],
  ])('%s usa a notação do WhatsApp', (action, expected) => {
    const marker = WHATSAPP_MARKER_BY_ACTION[action]
    expect(wrapSelection({ text: 'oi', start: 0, end: 2, marker }).text).toBe(expected)
  })
})

describe('QuickReplyWhatsAppPreview', () => {
  it('renderiza negrito, itálico, tachado e monoespaçado', () => {
    const markup = renderToStaticMarkup(<QuickReplyWhatsAppPreview body={'*a* _b_ ~c~ ```d```'} labels={LABELS} />)
    expect(markup).toContain('<strong>a</strong>')
    expect(markup).toContain('<em>b</em>')
    expect(markup).toMatch(/<(del|s)>c<\/(del|s)>/)
    expect(markup).toMatch(/<code[^>]*>d<\/code>/)
    expect(markup).toContain(LABELS.previewTitle)
  })

  it('sem texto, mostra o aviso de corpo vazio', () => {
    expect(renderToStaticMarkup(<QuickReplyWhatsAppPreview body="" labels={LABELS} />)).toContain(
      LABELS.previewEmptyBody,
    )
  })

  it('lista os anexos pelo nome do arquivo', () => {
    const markup = renderToStaticMarkup(
      <QuickReplyWhatsAppPreview
        body="Segue"
        attachments={[{ uploadId: 'u1', filename: 'contrato.pdf', mimeType: 'application/pdf', sizeBytes: 10 }]}
        labels={LABELS}
      />,
    )
    expect(markup).toContain('contrato.pdf')
  })
})

describe('resolvePreviewVariables', () => {
  const variables = [
    { id: 'name', label: 'Nome do cliente', marker: '{{nome}}', value: 'Maria' },
    { id: 'city', label: 'Cidade', marker: '{{cidade}}', value: '' },
  ]

  it('usa o exemplo, cai no rótulo e deixa marcador desconhecido como está', () => {
    expect(resolvePreviewVariables('Oi {{nome}} de {{cidade}} {{cpf}}', variables)).toBe('Oi Maria de Cidade {{cpf}}')
  })
})

describe('QuickReplyFormattingToolbar', () => {
  it('expõe os quatro botões com nome acessível', () => {
    const markup = renderToStaticMarkup(<QuickReplyFormattingToolbar labels={LABELS} onFormat={() => {}} />)
    for (const label of [LABELS.formatBold, LABELS.formatItalic, LABELS.formatStrikethrough, LABELS.formatMonospace]) {
      expect(markup).toContain(`aria-label="${label}"`)
    }
    expect(markup).toContain('role="toolbar"')
  })

  it('o clique entrega a ação ao dono do campo', () => {
    const received: string[] = []
    const element = QuickReplyFormattingToolbar({ labels: LABELS, onFormat: (action) => received.push(action) })
    const buttons = element.props.children as { props: { onClick: () => void } }[]
    for (const button of buttons) button.props.onClick()
    expect(received).toEqual(['bold', 'italic', 'strikethrough', 'monospace'])
  })
})

describe('QuickRepliesWorkspace com labels antigas', () => {
  it('aceita labels parciais sem as chaves novas', () => {
    expect(() => renderToStaticMarkup(<QuickRepliesWorkspace api={{}} labels={{ title: 'X' }} />)).not.toThrow()
  })
})

describe('FlowWhatsAppPreview sobre o balão compartilhado', () => {
  it('mantém corpo formatado, botões e aviso de modo', () => {
    const markup = renderToStaticMarkup(
      <FlowWhatsAppPreview
        body="*Oi*"
        options={[
          ['1', 'Sim'],
          ['2', 'Não'],
        ]}
      />,
    )
    expect(markup).toContain('bg-[#e5ddd5]')
    expect(markup).toContain('<strong>Oi</strong>')
    expect(markup).toContain('Sim')
    expect(markup).toContain('Não')
  })

  it('sem corpo nem opções, mostra só o placeholder, fora do balão', () => {
    expect(renderToStaticMarkup(<FlowWhatsAppPreview body="" />)).not.toContain('bg-[#e5ddd5]')
  })
})
