/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'

import { ChangePasswordWithCurrentForm } from './ChangePasswordWithCurrentForm'
import { PhoneVerificationPanel, buildWhatsappLink } from './PhoneVerificationPanel'
import { StaffAccountRecoveryPanel } from './StaffAccountRecoveryPanel'
import type { AccountControls } from './accountControls'

const noop = async (): Promise<void> => undefined

describe('conta — formulários', () => {
  it('a troca de senha pede a senha atual, a nova e a repetição', () => {
    const html = renderToStaticMarkup(<ChangePasswordWithCurrentForm onSubmit={noop} />)
    expect(html).toContain('Senha atual')
    expect(html).toContain('Repita a nova senha')
    expect(html).toContain('current-password')
  })

  it('os controles são slots: a casa troca o campo e o botão', () => {
    const controls: AccountControls = {
      Field: (props) => <div data-slot="campo">{props.label}</div>,
      Button: (props) => <div data-slot="botao">{props.children}</div>,
    }
    const html = renderToStaticMarkup(<ChangePasswordWithCurrentForm controls={controls} onSubmit={noop} />)
    expect(html).toContain('data-slot="campo"')
    expect(html).toContain('data-slot="botao"')
    expect(html).not.toContain('<input')
  })
})

describe('conta — verificação do telefone', () => {
  it('modo inbound: botão "Confirmar pelo WhatsApp" com a mensagem pronta', () => {
    const html = renderToStaticMarkup(
      <PhoneVerificationPanel
        isVerified={false}
        onRefresh={noop}
        verification={{ method: 'whatsapp-inbound', inbound: { code: '482913', message: 'Confirmar meu número: 482913' } }}
        whatsappNumber="+55 11 4000-0000"
      />,
    )
    expect(html).toContain('Confirmar pelo WhatsApp')
    expect(html).toContain('https://wa.me/551140000000?text=Confirmar%20meu%20n%C3%BAmero%3A%20482913')
  })

  it('modo envio: campo do código; já verificado: só o selo', () => {
    const sent = renderToStaticMarkup(<PhoneVerificationPanel isVerified={false} onRefresh={noop} onSubmitCode={noop} verification={{ method: 'sms', isSent: true }} />)
    expect(sent).toContain('Código recebido')
    const done = renderToStaticMarkup(<PhoneVerificationPanel isVerified onRefresh={noop} verification={undefined} />)
    expect(done).toContain('Telefone verificado')
  })

  it('o link do WhatsApp só leva dígitos no número', () => {
    expect(buildWhatsappLink({ number: '(11) 4000-0000', message: 'oi' })).toBe('https://wa.me/1140000000?text=oi')
  })
})

describe('conta — recuperação assistida (equipe)', () => {
  it('mostra a situação sem e-mail nem telefone completos e só destrava quando bloqueada', () => {
    const html = renderToStaticMarkup(
      <StaffAccountRecoveryPanel
        account={{ isEmailVerified: false, isPhoneVerified: true, isLocked: true, maskedCpf: '•••.•••.•••-12', reservationCodes: ['RES-1'] }}
        onRecover={noop}
      />,
    )
    expect(html).toContain('E-mail não confirmado')
    expect(html).toContain('Telefone verificado')
    expect(html).toContain('RES-1')
    expect(html).toContain('Destravar conta')
    expect(html).toContain('Conferi a identidade')
  })
})
