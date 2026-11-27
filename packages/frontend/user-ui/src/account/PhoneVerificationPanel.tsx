/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Mostra o caminho certo para confirmar o telefone: "Confirmar pelo WhatsApp" (mensagem pronta no chat da
 * empresa; a tela atualiza sozinha) ou o campo do código (métodos de envio). Some quando já está verificado.
 */

import { useEffect, useState, type FormEvent } from 'react'

import type { PhoneVerificationStart } from '../providers/types'
import { DEFAULT_ACCOUNT_CONTROLS, type AccountControls } from './accountControls'
import { DEFAULT_ACCOUNT_LABELS, type AccountLabels } from './accountLabels'
import { useAccountAction } from './useAccountAction'

export const DEFAULT_VERIFICATION_POLL_MILLISECONDS = 4000

export type PhoneVerificationPanelProps = {
  readonly verification: PhoneVerificationStart | undefined
  readonly isVerified: boolean
  /** Número do WhatsApp da empresa, só dígitos com DDI (vai em `https://wa.me/<número>`). */
  readonly whatsappNumber?: string
  /** Recarrega o perfil; chamada em intervalo enquanto espera a mensagem no WhatsApp. */
  readonly onRefresh: () => Promise<void>
  readonly onSubmitCode?: (code: string) => Promise<void>
  readonly onResend?: () => Promise<void>
  readonly pollMilliseconds?: number
  readonly labels?: Partial<AccountLabels>
  readonly controls?: AccountControls
}

export function buildWhatsappLink(params: { readonly number: string; readonly message: string }): string {
  return `https://wa.me/${params.number.replace(/\D/g, '')}?text=${encodeURIComponent(params.message)}`
}

export function PhoneVerificationPanel(props: PhoneVerificationPanelProps) {
  const labels = { ...DEFAULT_ACCOUNT_LABELS, ...props.labels }
  const { Field, Button } = props.controls ?? DEFAULT_ACCOUNT_CONTROLS
  const action = useAccountAction()
  const [code, setCode] = useState('')
  const inbound = props.verification?.inbound
  const isWaiting = Boolean(inbound) && !props.isVerified

  useEffect(() => {
    if (!isWaiting) return undefined
    const timer = setInterval(() => void props.onRefresh(), props.pollMilliseconds ?? DEFAULT_VERIFICATION_POLL_MILLISECONDS)
    return () => clearInterval(timer)
  }, [isWaiting, props.onRefresh, props.pollMilliseconds])

  if (props.isVerified) return <p className="text-sm text-green-700 dark:text-green-300" role="status">{labels.phoneVerified}</p>
  if (!props.verification) return null

  if (inbound && props.whatsappNumber) {
    return (
      <div className="space-y-2">
        <Button href={buildWhatsappLink({ number: props.whatsappNumber, message: inbound.message })}>{labels.confirmByWhatsapp}</Button>
        <p className="text-sm text-gray-600 dark:text-gray-300" role="status">{labels.waitingWhatsapp}</p>
      </div>
    )
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault()
    if (props.onSubmitCode) void action.run(() => props.onSubmitCode!(code))
  }

  return (
    <form className="space-y-3" onSubmit={handleSubmit}>
      <Field autoComplete="one-time-code" id="account-verification-code" inputMode="numeric" label={labels.verificationCode} onChange={setCode} value={code} {...(action.error ? { error: action.error } : {})} />
      <div className="flex gap-2">
        <Button isDisabled={action.isRunning || !code} type="submit">{labels.verificationSubmit}</Button>
        {props.onResend ? <Button onClick={() => void action.run(props.onResend!)} variant="secondary">{labels.verificationResend}</Button> : null}
      </div>
    </form>
  )
}
