import { describe, expect, it } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'

import { QuickRepliesBar, splitQuickReplies } from './QuickRepliesBar'
import type { QuickReply } from './quickReply.types'

const ITEMS: QuickReply[] = ['Saudação', 'Documento', 'Preço', 'Endereço', 'Despedida', 'Horário'].map((title, index) => ({
  id: String(index), title, shortcut: `s${index}`, body: `Texto ${title}`,
}))

describe('splitQuickReplies', () => {
  it('mantém os primeiros na faixa e manda o resto para o menu', () => {
    const { visible, overflow } = splitQuickReplies(ITEMS, 4)
    expect(visible.map((item) => item.title)).toEqual(['Saudação', 'Documento', 'Preço', 'Endereço'])
    expect(overflow.map((item) => item.title)).toEqual(['Despedida', 'Horário'])
  })

  it('nunca deixa a faixa sem botão e aceita teto maior que a lista', () => {
    expect(splitQuickReplies(ITEMS, 0).visible).toHaveLength(1)
    expect(splitQuickReplies(ITEMS, 99).overflow).toHaveLength(0)
  })
})

describe('QuickRepliesBar', () => {
  it('desenha uma barra de ferramentas com um botão por mensagem e o "Mais" só quando sobra', () => {
    const markup = renderToStaticMarkup(<QuickRepliesBar items={ITEMS} onSelect={() => {}} />)
    expect(markup).toContain('role="toolbar"')
    expect(markup).toContain('aria-label="Mensagens prontas"')
    expect(markup).toContain('Saudação')
    expect(markup).not.toContain('Despedida')
    expect(markup).toContain('aria-haspopup="menu"')
    expect(markup).toContain('aria-expanded="false"')
  })

  it('sem sobra não mostra o "Mais", e sem mensagens não mostra nada', () => {
    expect(renderToStaticMarkup(<QuickRepliesBar items={ITEMS.slice(0, 2)} onSelect={() => {}} />)).not.toContain('aria-haspopup')
    expect(renderToStaticMarkup(<QuickRepliesBar items={[]} onSelect={() => {}} />)).toBe('')
  })

  it('aceita o vocabulário trocado', () => {
    const markup = renderToStaticMarkup(<QuickRepliesBar items={ITEMS} maxVisible={2} labels={{ more: 'More', toolbar: 'Saved replies' }} onSelect={() => {}} />)
    expect(markup).toContain('More')
    expect(markup).toContain('aria-label="Saved replies"')
  })
})
