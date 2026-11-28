/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Só exibição: o valor exato continua sendo o texto decimal do contrato; `Number` aqui serve ao
 * `Intl` e nunca volta para conta nem para o servidor.
 */

import { isDecimalText, normalizeDecimal } from '@adatechnology/recipe-contracts'

export function formatMoney(params: {
  readonly value: string
  readonly locale: string
  readonly currency: string
}): string {
  return new Intl.NumberFormat(params.locale, {
    style: 'currency',
    currency: params.currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(Number(params.value))
}

export function formatCents(params: {
  readonly cents: number
  readonly locale: string
  readonly currency: string
}): string {
  return new Intl.NumberFormat(params.locale, { style: 'currency', currency: params.currency }).format(
    params.cents / 100,
  )
}

export function formatQuantity(params: { readonly value: string; readonly locale: string }): string {
  return new Intl.NumberFormat(params.locale, { maximumFractionDigits: 4 }).format(Number(params.value))
}

/** `3250` pontos-base → "32,5 %". */
export function formatBasisPoints(params: { readonly basisPoints: number; readonly locale: string }): string {
  return new Intl.NumberFormat(params.locale, { style: 'percent', maximumFractionDigits: 2 }).format(
    params.basisPoints / 10_000,
  )
}

export function formatDateTime(params: { readonly value: string; readonly locale: string }): string {
  return new Intl.DateTimeFormat(params.locale, { dateStyle: 'short', timeStyle: 'short', hourCycle: 'h23' }).format(
    new Date(params.value),
  )
}

/** Texto do contrato (`"12.5000"`) → campo do formulário no idioma (`"12,5"`). */
export function toInputDecimal(params: { readonly value: string; readonly locale: string }): string {
  const trimmed = params.value.includes('.') ? params.value.replace(/0+$/, '').replace(/\.$/, '') : params.value
  return params.locale.startsWith('pt') ? trimmed.replace('.', ',') : trimmed
}

/** Campo digitado → texto do contrato, ou `undefined` se não for número válido. */
export function fromInputDecimal(text: string): string | undefined {
  const candidate = text.trim().replace(/\s/g, '').replace(',', '.')
  return isDecimalText(candidate) ? normalizeDecimal(candidate) : undefined
}
