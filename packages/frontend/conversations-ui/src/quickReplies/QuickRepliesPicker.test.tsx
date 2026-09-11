import { describe, expect, it } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'

import { QuickRepliesPicker } from './QuickRepliesPicker'
import type { QuickReply } from './quickReply.types'

const ITEMS: QuickReply[] = [
  { id: '1', title: 'Saudação', shortcut: 'ola', body: 'Olá!' },
  { id: '2', title: 'Pedido de documento', shortcut: 'doc', body: 'Envie o RG.' },
]

const GREETING_WITH_VARIABLE: QuickReply = {
  id: '3',
  title: 'Boas-vindas',
  shortcut: 'bv',
  body: 'Olá {{nome}}, bem-vindo!',
}

describe('QuickRepliesPicker', () => {
  it('mostra o estado vazio quando não há mensagens cadastradas', () => {
    const markup = renderToStaticMarkup(
      <QuickRepliesPicker
        id="qr"
        items={[]}
        search=""
        highlightedIndex={0}
        isLoading={false}
        onHover={() => {}}
        onSelect={() => {}}
      />,
    )
    expect(markup).toContain('Nenhuma mensagem pronta cadastrada ainda.')
  })

  it('mostra o estado de nenhum resultado quando a busca não acha nada', () => {
    const markup = renderToStaticMarkup(
      <QuickRepliesPicker
        id="qr"
        items={[]}
        search="boleto"
        highlightedIndex={0}
        isLoading={false}
        onHover={() => {}}
        onSelect={() => {}}
      />,
    )
    expect(markup).toContain('Nenhuma mensagem encontrada.')
  })

  it('mostra o carregamento antes da lista', () => {
    const markup = renderToStaticMarkup(
      <QuickRepliesPicker
        id="qr"
        items={[]}
        search=""
        highlightedIndex={0}
        isLoading
        onHover={() => {}}
        onSelect={() => {}}
      />,
    )
    expect(markup).toContain('Carregando mensagens prontas')
  })

  it('marca a opção destacada com aria-selected', () => {
    const markup = renderToStaticMarkup(
      <QuickRepliesPicker
        id="qr"
        items={ITEMS}
        search=""
        highlightedIndex={1}
        isLoading={false}
        onHover={() => {}}
        onSelect={() => {}}
      />,
    )
    expect(markup).toContain('id="qr-option-1"')
    expect(markup).toMatch(/id="qr-option-1"[^>]*aria-selected="true"/)
    expect(markup).toMatch(/id="qr-option-0"[^>]*aria-selected="false"/)
  })

  it('destaca o trecho buscado sem produzir HTML a partir do texto cadastrado', () => {
    const markup = renderToStaticMarkup(
      <QuickRepliesPicker
        id="qr"
        items={ITEMS}
        search="doc"
        highlightedIndex={0}
        isLoading={false}
        onHover={() => {}}
        onSelect={() => {}}
      />,
    )
    expect(markup).toContain('<mark')
    expect(markup).toContain('Pedido de ')
  })

  it('mostra a prévia do corpo com a variável já resolvida (QR-04), nunca o marcador cru', () => {
    const markup = renderToStaticMarkup(
      <QuickRepliesPicker
        id="qr"
        items={[GREETING_WITH_VARIABLE]}
        search=""
        highlightedIndex={0}
        isLoading={false}
        onHover={() => {}}
        onSelect={() => {}}
        variables={{ nome: 'João' }}
      />,
    )
    expect(markup).toContain('Olá João, bem-vindo!')
    expect(markup).not.toContain('{{nome}}')
  })
})
