import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'

import { FORMATTING_ACTION, WHATSAPP_MARKER_BY_ACTION } from '../lib/composer-formatting'
import { FlowWhatsAppPreview } from '../flows/FlowWhatsAppPreview'
import { DEFAULT_QUICK_REPLIES_WORKSPACE_LABELS } from './labels'
import { QuickRepliesWorkspace } from './QuickRepliesWorkspace'
import { QuickReplyFormattingToolbar } from './QuickReplyFormattingToolbar'
import { QuickReplyWhatsAppPreview, resolvePreviewVariables } from './QuickReplyWhatsAppPreview'
import {
  changedRange,
  computeFormattingEdit,
  toggleLinePrefix,
  formattingActionForShortcut,
  wrapSelection,
  type FormattingShortcutEvent,
} from './quickReplyFormatting'

describe('wrapSelection — regras do WhatsApp', () => {
  it('deixa o espaço das pontas fora do marcador', () => {
    expect(wrapSelection({ text: 'Olá mundo ', start: 3, end: 10, marker: '*' })).toEqual({
      text: 'Olá *mundo* ',
      selectionStart: 5,
      selectionEnd: 10,
    })
  })

  it('desliga quando o marcador está dentro da seleção', () => {
    expect(wrapSelection({ text: 'a *b* c', start: 2, end: 5, marker: '*' })).toEqual({
      text: 'a b c',
      selectionStart: 2,
      selectionEnd: 3,
    })
  })

  it('desliga quando o marcador está logo fora da seleção', () => {
    expect(wrapSelection({ text: 'a ```b``` c', start: 5, end: 6, marker: '```' })).toEqual({
      text: 'a b c',
      selectionStart: 2,
      selectionEnd: 3,
    })
  })

  it('formata cada linha não vazia separadamente', () => {
    expect(wrapSelection({ text: 'um\n\n dois ', start: 0, end: 10, marker: '_' })).toEqual({
      text: '_um_\n\n _dois_ ',
      selectionStart: 0,
      selectionEnd: 14,
    })
  })

  it('desliga em todas as linhas quando todas já estão formatadas', () => {
    expect(wrapSelection({ text: '~um~\n~dois~', start: 0, end: 11, marker: '~' }).text).toBe('um\ndois')
  })

  it('só espaço selecionado cai no par vazio', () => {
    expect(wrapSelection({ text: 'a  b', start: 1, end: 3, marker: '*' }).text).toBe('a*  *b')
  })
})

describe('computeFormattingEdit', () => {
  it('aplica a notação da ação e devolve a seleção nova', () => {
    expect(
      computeFormattingEdit({ text: 'oi', selectionStart: 0, selectionEnd: 2, action: 'bold', maximumLength: 10 }),
    ).toEqual({ text: '*oi*', selectionStart: 1, selectionEnd: 3 })
  })

  it('não aplica quando passaria do limite', () => {
    expect(
      computeFormattingEdit({ text: 'oi', selectionStart: 0, selectionEnd: 2, action: 'monospace', maximumLength: 7 }),
    ).toBeUndefined()
  })

  it('aceita chegar exatamente ao limite', () => {
    expect(
      computeFormattingEdit({ text: 'oi', selectionStart: 0, selectionEnd: 2, action: 'italic', maximumLength: 4 })
        ?.text,
    ).toBe('_oi_')
  })

  it('desligar nunca esbarra no limite', () => {
    expect(
      computeFormattingEdit({ text: '*oi*', selectionStart: 0, selectionEnd: 4, action: 'bold', maximumLength: 4 })
        ?.text,
    ).toBe('oi')
  })
})

describe('formattingActionForShortcut', () => {
  const base: FormattingShortcutEvent = {
    key: 'b',
    ctrlKey: true,
    metaKey: false,
    shiftKey: false,
    altKey: false,
    isComposing: false,
  }

  it('Ctrl/Cmd+B é negrito, Ctrl/Cmd+I é itálico', () => {
    expect(formattingActionForShortcut(base)).toBe('bold')
    expect(formattingActionForShortcut({ ...base, ctrlKey: false, metaKey: true, key: 'I' })).toBe('italic')
  })

  it('ignora sem modificador, com shift, alt, composição ou outra tecla', () => {
    expect(formattingActionForShortcut({ ...base, ctrlKey: false })).toBeUndefined()
    expect(formattingActionForShortcut({ ...base, shiftKey: true })).toBeUndefined()
    expect(formattingActionForShortcut({ ...base, altKey: true })).toBeUndefined()
    expect(formattingActionForShortcut({ ...base, isComposing: true })).toBeUndefined()
    expect(formattingActionForShortcut({ ...base, key: 'u' })).toBeUndefined()
  })
})

describe('changedRange', () => {
  it('isola a inserção', () => {
    expect(changedRange('a b', 'a *b*')).toEqual({ start: 2, end: 3, insertedText: '*b*' })
  })

  it('isola a remoção', () => {
    expect(changedRange('*b*', '*b')).toEqual({ start: 2, end: 3, insertedText: '' })
  })
})

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

  it('ignora variável sem marcador', () => {
    expect(resolvePreviewVariables('Oi', [{ id: 'x', label: 'X', marker: '', value: 'Y' }])).toBe('Oi')
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
    expect(received).toEqual([
      'bold',
      'italic',
      'strikethrough',
      'monospace',
      'inlineCode',
      'bulletedList',
      'numberedList',
      'quote',
    ])
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

describe('toggleLinePrefix', () => {
  it('põe o prefixo na linha do cursor e move o cursor junto', () => {
    expect(toggleLinePrefix({ text: 'a\nbc', start: 3, end: 3, action: 'bulletedList' })).toEqual({
      text: 'a\n- bc',
      selectionStart: 5,
      selectionEnd: 5,
    })
  })

  it('numera cada linha selecionada em sequência, pulando a linha em branco', () => {
    expect(toggleLinePrefix({ text: 'um\n\ndois\ntrês', start: 1, end: 10, action: 'numberedList' })).toEqual({
      text: '1. um\n\n2. dois\n3. três',
      selectionStart: 0,
      selectionEnd: 22,
    })
  })

  it('tira o prefixo de todas quando todas já têm', () => {
    expect(toggleLinePrefix({ text: '> a\n> b', start: 0, end: 7, action: 'quote' }).text).toBe('a\nb')
  })

  it('completa as que faltam quando só algumas têm', () => {
    expect(toggleLinePrefix({ text: '- a\nb', start: 0, end: 5, action: 'bulletedList' }).text).toBe('- a\n- b')
  })

  it('linha vazia com cursor ganha o prefixo', () => {
    expect(toggleLinePrefix({ text: '', start: 0, end: 0, action: 'quote' })).toEqual({
      text: '> ',
      selectionStart: 2,
      selectionEnd: 2,
    })
  })

  it('seleção terminando na quebra não puxa a linha de baixo', () => {
    expect(toggleLinePrefix({ text: 'a\nb', start: 0, end: 2, action: 'bulletedList' }).text).toBe('- a\nb')
  })
})

describe('computeFormattingEdit com as ações de linha e código', () => {
  it('código inline usa crase simples', () => {
    expect(
      computeFormattingEdit({ text: 'x', selectionStart: 0, selectionEnd: 1, action: 'inlineCode', maximumLength: 10 })
        ?.text,
    ).toBe('`x`')
  })

  it('prefixo de linha respeita o limite', () => {
    expect(
      computeFormattingEdit({
        text: 'a\nb',
        selectionStart: 0,
        selectionEnd: 3,
        action: 'bulletedList',
        maximumLength: 6,
      }),
    ).toBeUndefined()
    expect(
      computeFormattingEdit({
        text: 'a\nb',
        selectionStart: 0,
        selectionEnd: 3,
        action: 'bulletedList',
        maximumLength: 7,
      })?.text,
    ).toBe('- a\n- b')
  })
})

describe('QuickRepliesWorkspace — ações da tabela no padrão do pacote', () => {
  // As linhas só chegam depois do carregamento assíncrono; o render estático não as mostra, então o
  // contrato é conferido no fonte, como em flows/workspaceContract.test.ts.
  const source = readFileSync(new URL('./QuickRepliesWorkspace.tsx', import.meta.url), 'utf8')

  it('editar e excluir são cv-header-icon com Pencil e Trash2, nome acessível com o título', () => {
    expect(source).toContain('className="cv-header-icon"')
    expect(source).toContain('<Pencil size={14}')
    expect(source).toContain('<Trash2 size={14}')
    expect(source).toContain('aria-label={`${text.edit}: ${quickReply.title}`}')
  })

  it('confirmação usa cv-header-action--danger e o criar usa --primary', () => {
    expect(source).toContain('cv-header-action cv-header-action--danger')
    expect(source).toContain('cv-header-action cv-header-action--primary')
  })
})
