/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'

import type { UserProfile } from './providers/types'
import { TeamMemberPasswordForm } from './TeamMemberPasswordForm'
import { TEAM_PASSWORD_MIN_LENGTH } from './TeamMemberForm'
import { DEFAULT_USER_LABELS } from './workspace/labels'

const MEMBER: UserProfile = { id: 'u1', email: 'ana@example.com', name: 'Ana', role: 'agent', isActive: true }
const noop = (): void => undefined

describe('TeamMemberPasswordForm', () => {
  it('pede a senha com o mínimo do servidor, sem preenchimento do gerenciador de senhas', () => {
    const html = renderToStaticMarkup(
      <TeamMemberPasswordForm member={MEMBER} saving={false} onSubmit={noop} onCancel={noop} />,
    )
    expect(html).toContain('type="password"')
    expect(html).toContain('autoComplete="new-password"')
    expect(html).toContain(`minLength="${TEAM_PASSWORD_MIN_LENGTH}"`)
    expect(html).toContain('ana@example.com')
    expect(html).toContain(DEFAULT_USER_LABELS.teamNewPassword)
  })

  it('o botão começa desabilitado (senha curta demais) e o erro do servidor aparece no campo', () => {
    const html = renderToStaticMarkup(
      <TeamMemberPasswordForm member={MEMBER} saving={false} error="Senha fraca" onSubmit={noop} onCancel={noop} />,
    )
    expect(html).toContain('disabled=""')
    expect(html).toContain('aria-invalid="true"')
    expect(html).toContain('Senha fraca')
  })
})
