import { describe, expect, it } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'

import { ConversationContextPanel } from './ConversationContextPanel'

const noop = () => {}

describe('ConversationContextPanel onSelect', () => {
  it('vira botão só no card preenchido que declara onSelect', () => {
    const markup = renderToStaticMarkup(
      <ConversationContextPanel
        defaultOpen
        entries={[
          { key: 'items', label: 'Itens', value: '2x Pudim, 1x Café', onSelect: noop },
          { key: 'code', label: 'Código', value: 'PED-1' },
          { key: 'time', label: 'Horário', onSelect: noop },
        ]}
      />,
    )

    expect(markup.match(/<button type="button" class="w-full/g)?.length).toBe(1)
    expect(markup).toContain('data-cv-tooltip="2x Pudim, 1x Café"')
  })
})
