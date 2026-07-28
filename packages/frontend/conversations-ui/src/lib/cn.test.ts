import { describe, expect, it } from 'bun:test'

import { cn } from './cn'

describe('cn', () => {
  // O contrato de `classNames`/`className` dos componentes depende disto: se o override não vencer,
  // a API de customização é decorativa. Concatenar falharia justo no caso comum — o Tailwind emite
  // `px-2` antes de `px-4`, então a base ganharia de quem quer apertar o espaçamento.
  it('o override do host vence a classe base em conflito', () => {
    expect(cn('px-4 py-3', 'px-2')).toBe('py-3 px-2')
  })

  it('mantém o que não conflita', () => {
    expect(cn('flex items-center gap-3', 'gap-1')).toBe('flex items-center gap-1')
  })

  it('preserva classes próprias do pacote, que o merge não conhece', () => {
    expect(cn('cv-row flex', 'bg-red-50')).toBe('cv-row flex bg-red-50')
  })

  it('ignora ausente, falso e vazio', () => {
    expect(cn('border-b', undefined, false, '')).toBe('border-b')
  })

  it('aplica condicional na ordem recebida', () => {
    const isCompact = false
    expect(cn('mt-2', isCompact && 'mt-8', 'mt-4')).toBe('mt-4')
  })
})
