import { describe, expect, it } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'

import { DarkModeToggle } from './DarkModeToggle'

const noop = () => undefined

describe('DarkModeToggle', () => {
  it('nomeia o destino do clique, não o tema atual', () => {
    const markup = renderToStaticMarkup(<DarkModeToggle isDark={false} onToggle={noop} />)

    expect(markup).toContain('aria-label="Tema escuro"')
  })

  it('inverte o rótulo quando o tema escuro está no ar', () => {
    const markup = renderToStaticMarkup(<DarkModeToggle isDark onToggle={noop} />)

    expect(markup).toContain('aria-label="Tema claro"')
  })

  it('aceita rótulo do host', () => {
    const markup = renderToStaticMarkup(
      <DarkModeToggle isDark={false} onToggle={noop} labels={{ toDark: 'Modo noturno' }} />,
    )

    expect(markup).toContain('aria-label="Modo noturno"')
  })

  it('só-ícone garante a área de toque mínima', () => {
    const markup = renderToStaticMarkup(<DarkModeToggle isDark={false} onToggle={noop} />)

    expect(markup).toContain('cv-touch')
  })

  it('com rótulo visível dispensa a área de toque forçada e o tooltip', () => {
    const markup = renderToStaticMarkup(<DarkModeToggle isDark={false} onToggle={noop} showLabel />)

    expect(markup).not.toContain('cv-touch')
    expect(markup).not.toContain('data-cv-tooltip')
    expect(markup).toContain('Tema escuro')
  })

  it('deixa o host trocar a aparência sem herdar o utilitário do pacote', () => {
    const markup = renderToStaticMarkup(
      <DarkModeToggle isDark={false} onToggle={noop} className="rounded-2xl px-4" />,
    )

    expect(markup).toContain('rounded-2xl')
    expect(markup).not.toContain('rounded-lg')
    expect(markup).not.toContain('px-3')
  })

  /** Trava o contorno da limitação documentada: token do host não é família conhecida do merge. */
  it('resolve raio de token do host quando ele vem na forma arbitrária', () => {
    const markup = renderToStaticMarkup(
      <DarkModeToggle isDark={false} onToggle={noop} className="rounded-[var(--radius-panel)]" />,
    )

    expect(markup).not.toContain('rounded-lg')
  })

  it('cede o tamanho do ícone quando o host manda classe', () => {
    const markup = renderToStaticMarkup(
      <DarkModeToggle isDark={false} onToggle={noop} classNames={{ icon: 'size-4' }} />,
    )

    expect(markup).toContain('size-4')
    expect(markup).not.toContain('width="16"')
  })

  it('marca o ícone como decorativo — o rótulo já é anunciado', () => {
    const markup = renderToStaticMarkup(<DarkModeToggle isDark={false} onToggle={noop} />)

    expect(markup).toContain('aria-hidden="true"')
  })
})
