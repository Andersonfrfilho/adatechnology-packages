/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { normalizeCouponCode, type CartItem, type CouponValidation } from '@adatechnology/coupon-contracts'
import { useState } from 'react'

import { readRejections } from '../lib/apiError'
import { useCouponsPublicApi } from '../providers/CouponsProvider'

export type CouponCheck =
  | { readonly status: 'idle' }
  | { readonly status: 'checking' }
  | { readonly status: 'valid'; readonly validation: CouponValidation }
  | { readonly status: 'invalid'; readonly validation?: CouponValidation; readonly reasons: readonly string[] }

export type PreviewCoupon = (input: {
  readonly code: string
  readonly items: readonly CartItem[]
}) => Promise<CouponValidation>

/**
 * Camada headless do campo de cupom. A prévia é conforto: o servidor confere de novo no resgate,
 * então o valor que a tela mostra nunca é a palavra final.
 */
export function useCouponPreview(params: {
  readonly preview?: PreviewCoupon
  readonly onResolved?: (validation: CouponValidation | undefined) => void
}) {
  const api = useCouponsPublicApi()
  const preview = params.preview ?? api.previewCoupon
  const [check, setCheck] = useState<CouponCheck>({ status: 'idle' })

  function reset(): void {
    setCheck({ status: 'idle' })
    params.onResolved?.(undefined)
  }

  async function apply(code: string, items: readonly CartItem[]): Promise<void> {
    const normalized = normalizeCouponCode(code)
    if (!preview || normalized === '') return
    setCheck({ status: 'checking' })
    try {
      const validation = await preview({ code: normalized, items })
      if (validation.valid) {
        setCheck({ status: 'valid', validation })
        params.onResolved?.(validation)
        return
      }
      setCheck({ status: 'invalid', validation, reasons: validation.reasons })
      params.onResolved?.(undefined)
    } catch (error) {
      setCheck({ status: 'invalid', reasons: readRejections(error) })
      params.onResolved?.(undefined)
    }
  }

  return { check, apply, reset, isAvailable: Boolean(preview) }
}
