/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import {
  normalizeCouponCode,
  type CartItem,
  type CouponRejection,
  type CouponValidation,
} from '@adatechnology/coupon-contracts'
import { Check, X } from 'lucide-react'

import { useCouponPreview, type CouponCheck, type PreviewCoupon } from '../hooks/useCouponPreview'
import { formatCents } from '../lib/format'
import { rejectionMessage } from '../lib/labels'
import { useCouponsText } from '../providers/CouponsProvider'

export type CouponFieldProps = {
  readonly id: string
  readonly value: string
  readonly onChange: (code: string) => void
  /** Carrinho atual: o desconto depende dele (escopo, mínimo, teto). */
  readonly items: readonly CartItem[]
  /** A validação quando o código vale; `undefined` ao editar, remover ou ser recusado. */
  readonly onResolved?: (validation: CouponValidation | undefined) => void
  /** Troca a prévia (ex.: rota do BFF do host). Padrão: `publicApi.previewCoupon`. */
  readonly preview?: PreviewCoupon
  /** Estado controlado de fora (headless). */
  readonly check?: CouponCheck
}

/** Campo "aplicar cupom": mostra o desconto quando vale e todos os motivos quando não vale. */
export function CouponField(props: CouponFieldProps) {
  const { messages, format, locale, currency } = useCouponsText()
  const controller = useCouponPreview({
    ...(props.preview ? { preview: props.preview } : {}),
    ...(props.onResolved ? { onResolved: props.onResolved } : {}),
  })
  const check = props.check ?? controller.check
  if (!props.preview && !controller.isAvailable && !props.check) return null
  const errorId = `${props.id}-error`

  function handleChange(raw: string): void {
    props.onChange(normalizeCouponCode(raw))
    if (check.status !== 'idle') controller.reset()
  }

  return (
    <div className={`acp-root acp-coupon-field${check.status === 'invalid' ? ' acp-field--invalid' : ''}`}>
      <label className="acp-label" htmlFor={props.id}>
        {messages.couponLabel} <span className="acp-hint">{messages.couponHint}</span>
      </label>
      <div className="acp-coupon-row">
        <input
          id={props.id}
          className="acp-input"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={32}
          value={props.value}
          aria-invalid={check.status === 'invalid'}
          aria-describedby={check.status === 'invalid' ? errorId : undefined}
          onChange={(event) => handleChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return
            event.preventDefault()
            void controller.apply(props.value, props.items)
          }}
        />
        {check.status === 'valid' ? (
          <button
            type="button"
            className="acp-button acp-button--ghost"
            aria-label={messages.couponRemove}
            onClick={() => handleChange('')}
          >
            <X aria-hidden="true" className="acp-icon" />
          </button>
        ) : (
          <button
            type="button"
            className="acp-button acp-button--ghost"
            disabled={props.value === '' || check.status === 'checking'}
            aria-busy={check.status === 'checking'}
            onClick={() => void controller.apply(props.value, props.items)}
          >
            {check.status === 'checking' ? messages.couponChecking : messages.couponApply}
          </button>
        )}
      </div>
      {check.status === 'valid' ? (
        <p className="acp-status acp-status--success" role="status">
          <Check aria-hidden="true" className="acp-icon" />
          <span>
            {format('couponApplied', { discount: formatCents(check.validation.discountCents, locale, currency) })}
          </span>
        </p>
      ) : null}
      {check.status === 'invalid' ? (
        <div className="acp-error" id={errorId} role="alert">
          {check.reasons.length === 0 ? (
            <p>{messages.couponInvalid}</p>
          ) : (
            <ul className="acp-reasons">
              {check.reasons.map((reason) => (
                <li key={reason}>{rejectionMessage(messages, reason as CouponRejection)}</li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  )
}
