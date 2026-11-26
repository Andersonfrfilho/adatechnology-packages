import { describe, expect, it } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'

import { ActiveSwitch } from './TeamWorkspace'

const noop = () => undefined

function render(value: boolean, busy = false): string {
  return renderToStaticMarkup(<ActiveSwitch value={value} busy={busy} label="Ativar Ana" onToggle={noop} />)
}

describe('ActiveSwitch', () => {
  it('é um botão role=switch com aria-checked e nome (Space/Enter nativos do botão)', () => {
    expect(render(true)).toContain('role="switch"')
    expect(render(true)).toContain('type="button"')
    expect(render(true)).toContain('aria-checked="true"')
    expect(render(false)).toContain('aria-checked="false"')
    expect(render(true)).toContain('aria-label="Ativar Ana"')
  })

  it('o thumb se move por transform e não por left', () => {
    expect(render(true)).toContain('translate-x-5')
    expect(render(false)).toContain('translate-x-0')
    expect(render(true)).toContain('transition-transform')
    expect(render(true)).not.toContain('left-5.5')
    expect(render(true)).not.toContain('transition-all')
  })

  it('cor da trilha em 150 ms ease-out', () => {
    const markup = render(false)
    expect(markup).toContain('transition-colors')
    expect(markup).toContain('duration-150')
    expect(markup).toContain('ease-out')
  })

  it('tem foco visível e zera a transição com movimento reduzido', () => {
    const markup = render(false)
    expect(markup).toContain('focus-visible:ring-2')
    expect(markup).toContain('motion-reduce:transition-none')
  })

  it('ocupado desabilita o botão', () => {
    expect(render(true, true)).toContain('disabled=""')
  })
})
