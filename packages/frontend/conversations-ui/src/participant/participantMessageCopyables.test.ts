import { describe, expect, it } from 'bun:test'

import { isValidCnpj, isValidCpf } from './participantDocuments'
import { show } from './participantMessageFormat.test-helper'
import { parseInline } from './participantMessageInline'

function inline(line: string): string {
  return show(parseInline(line))
}

function copyable(kind: string, value: string): string {
  return `⟦k:${kind}:${value}⟧`
}

describe('check digits', () => {
  it('validates CPF', () => {
    expect(isValidCpf('52998224725')).toBe(true)
    expect(isValidCpf('52998224726')).toBe(false)
    expect(isValidCpf('11111111111')).toBe(false)
    expect(isValidCpf('1234567890')).toBe(false)
  })

  it('validates numeric and alphanumeric CNPJ', () => {
    expect(isValidCnpj('11222333000181')).toBe(true)
    expect(isValidCnpj('11222333000182')).toBe(false)
    expect(isValidCnpj('12ABC34501DE35')).toBe(true)
    expect(isValidCnpj('12ABC34501DE36')).toBe(false)
    expect(isValidCnpj('00000000000000')).toBe(false)
  })
})

describe('copyable - CPF', () => {
  it('detects valid CPF with and without mask', () => {
    expect(inline('CPF 529.982.247-25 ok')).toBe(`CPF ${copyable('cpf', '529.982.247-25')} ok`)
    expect(inline('52998224725')).toBe(copyable('cpf', '52998224725'))
    expect(inline('CPF: 529.982.247-25.')).toBe(`CPF: ${copyable('cpf', '529.982.247-25')}.`)
  })

  it('ignores repeated sequences and wrong check digits', () => {
    expect(inline('111.111.111-11')).toBe('111.111.111-11')
    expect(inline('11111111111')).toBe('11111111111')
    expect(inline('529.982.247-26')).toBe('529.982.247-26')
  })
})

describe('copyable - CNPJ', () => {
  it('detects valid numeric CNPJ with and without mask', () => {
    expect(inline('11.222.333/0001-81')).toBe(copyable('cnpj', '11.222.333/0001-81'))
    expect(inline('11222333000181')).toBe(copyable('cnpj', '11222333000181'))
  })

  it('detects the new alphanumeric CNPJ', () => {
    expect(inline('12.ABC.345/01DE-35')).toBe(copyable('cnpj', '12.ABC.345/01DE-35'))
    expect(inline('12ABC34501DE35')).toBe(copyable('cnpj', '12ABC34501DE35'))
  })

  it('ignores invalid CNPJ and does not take it for a phone', () => {
    expect(inline('11.222.333/0001-82')).toBe('11.222.333/0001-82')
    expect(inline('12ABC34501DE36')).toBe('12ABC34501DE36')
  })
})

describe('copyable - access key', () => {
  const KEY = '35260112345678000195550010000012341000012345'

  it('detects exactly 44 digits, bare or in groups of four', () => {
    expect(KEY).toHaveLength(44)
    expect(inline(`chave ${KEY}`)).toBe(`chave ${copyable('accessKey', KEY)}`)
    const grouped = KEY.match(/\d{4}/g)?.join(' ') ?? ''
    expect(inline(grouped)).toBe(copyable('accessKey', grouped))
  })

  it('ignores 43 and 45 digit runs', () => {
    expect(inline(KEY.slice(1))).toBe(KEY.slice(1))
    expect(inline(`${KEY}1`)).toBe(`${KEY}1`)
  })

  it('ignores a repeated sequence', () => {
    expect(inline('1'.repeat(44))).toBe('1'.repeat(44))
  })
})

describe('copyable - phone', () => {
  it('detects five formats and keeps the mask as typed', () => {
    expect(inline('(16) 99999-0000')).toBe(copyable('phone', '(16) 99999-0000'))
    expect(inline('+55 16 99999-0000')).toBe(copyable('phone', '+55 16 99999-0000'))
    expect(inline('16 99999-0000')).toBe(copyable('phone', '16 99999-0000'))
    expect(inline('(16) 3333-4444')).toBe(copyable('phone', '(16) 3333-4444'))
    expect(inline('+1 415 555 2671')).toBe(copyable('phone', '+1 415 555 2671'))
  })

  it('does not take bare 10 or 11 digits for a phone', () => {
    expect(inline('pedido 1234567890')).toBe('pedido 1234567890')
    expect(inline('16999990000')).toBe('16999990000')
    expect(inline('1633334444')).toBe('1633334444')
  })

  it('accepts a bare number only with +55, a bracketed DDD or a separator after the DDD', () => {
    expect(inline('+5516999990000')).toBe(copyable('phone', '+5516999990000'))
    expect(inline('(16)999990000')).toBe(copyable('phone', '(16)999990000'))
    expect(inline('16-999990000')).toBe(copyable('phone', '16-999990000'))
  })

  it('keeps the final dot outside', () => {
    expect(inline('ligue (16) 99999-0000.')).toBe(`ligue ${copyable('phone', '(16) 99999-0000')}.`)
  })
})

describe('copyable - e-mail', () => {
  it('detects e-mail addresses', () => {
    expect(inline('fale a@b.co.')).toBe(`fale ${copyable('email', 'a@b.co')}.`)
    expect(inline('ana.souza+x@mail.example.com.br')).toBe(copyable('email', 'ana.souza+x@mail.example.com.br'))
  })

  it('ignores malformed addresses', () => {
    expect(inline('@ana')).toBe('@ana')
    expect(inline('a@b')).toBe('a@b')
    expect(inline('a@.co')).toBe('a@.co')
  })
})

describe('copyable - false positives avoided', () => {
  it('does not highlight money, dates, short numbers or labels', () => {
    expect(inline('R$ 1.234,56')).toBe('R$ 1.234,56')
    expect(inline('10/10/2026')).toBe('10/10/2026')
    expect(inline('2026-10-01')).toBe('2026-10-01')
    expect(inline('12345')).toBe('12345')
    expect(inline('NF 4521')).toBe('NF 4521')
    expect(inline('total 1234567')).toBe('total 1234567')
  })

  it('does not detect inside inline code or inside a URL', () => {
    expect(inline('`529.982.247-25`')).toBe('⟦c:529.982.247-25⟧')
    expect(inline('`a@b.co`')).toBe('⟦c:a@b.co⟧')
    expect(inline('https://a.com/52998224725')).toBe('⟦l:https://a.com/52998224725→https://a.com/52998224725⟧')
  })

  it('lets a mark wrap a token', () => {
    expect(inline('*529.982.247-25*')).toBe(`⟦s:${copyable('cpf', '529.982.247-25')}⟧`)
  })
})
