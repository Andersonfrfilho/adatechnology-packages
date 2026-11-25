/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'

import { SignInForm } from './SignInForm'

const noop = async (): Promise<void> => undefined

describe('SignInForm — lembrar de mim', () => {
  it('por padrão a caixa não existe (formulário de sempre)', () => {
    const html = renderToStaticMarkup(<SignInForm onSubmit={noop} />)
    expect(html).not.toContain('type="checkbox"')
    expect(html).not.toContain('Lembrar de mim')
  })

  it('com showRememberMe a caixa nasce desmarcada, com rótulo associado', () => {
    const html = renderToStaticMarkup(<SignInForm onSubmit={noop} showRememberMe />)
    expect(html).toContain('id="user-ui-sign-in-remember"')
    expect(html).toContain('type="checkbox"')
    expect(html).toContain('for="user-ui-sign-in-remember"')
    expect(html).toContain('Lembrar de mim')
    expect(html).not.toContain('checked')
  })

  it('o rótulo é substituível por labels', () => {
    const html = renderToStaticMarkup(
      <SignInForm onSubmit={noop} showRememberMe labels={{ signInRememberMe: 'Manter conectado' }} />,
    )
    expect(html).toContain('Manter conectado')
  })
})
