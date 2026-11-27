/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import type { FieldIssue } from '@adatechnology/coupon-contracts'

import { fieldLabel } from '../lib/labels'
import { useCouponsText } from '../providers/CouponsProvider'

/** Id do controle de um caminho da API: o mesmo que o formulário usa. */
export function fieldControlId(prefix: string, field: string): string {
  return `${prefix}-${field.replace(/\./g, '-')}`
}

/**
 * "Confira: Nome, Código." — cada nome é um atalho: rola até o campo e põe o foco nele. Campo sem
 * rótulo conhecido aparece com o nome cru da API, nunca some.
 */
export function IssueSummary({ issues, prefix }: { readonly issues: readonly FieldIssue[]; readonly prefix: string }) {
  const { messages } = useCouponsText()
  if (issues.length === 0) return null

  function focus(field: string): void {
    if (typeof document === 'undefined') return
    const target =
      document.getElementById(fieldControlId(prefix, field)) ??
      document.querySelector<HTMLElement>(
        `[data-field^="${fieldControlId(prefix, field.split('.')[0] ?? field)}"] input, [data-field^="${fieldControlId(prefix, field.split('.')[0] ?? field)}"] textarea`,
      )
    target?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    target?.focus()
  }

  return (
    <div className="acp-issues" role="alert">
      <span>{messages.checkFields}</span>
      {issues.map((issue, index) => (
        <span key={issue.field}>
          <button type="button" className="acp-link" onClick={() => focus(issue.field)}>
            {fieldLabel(messages, issue.field)}
          </button>
          {index < issues.length - 1 ? ', ' : '.'}
        </span>
      ))}
    </div>
  )
}
