/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * O bot só pode dizer o suficiente para a pessoa reconhecer a própria conta: primeiro nome e inicial, e-mail com asteriscos.
 */

export function maskName(name: string): string {
  const [first = '', ...rest] = name.trim().split(/\s+/)
  const last = rest[rest.length - 1]
  return last ? `${first} ${last.slice(0, 1)}.` : first
}

export function maskEmail(email: string): string {
  const [local = '', domain = ''] = email.split('@')
  const [host = '', ...tail] = domain.split('.')
  return `${local.slice(0, 1)}***@${host.slice(0, 1)}***${tail.length > 0 ? `.${tail.join('.')}` : ''}`
}
