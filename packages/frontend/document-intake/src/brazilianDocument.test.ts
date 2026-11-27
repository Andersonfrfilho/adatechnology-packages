/* Copyright (c) 2026 Ada Technology. MIT License. */
import { describe, expect, test } from 'bun:test'

import {
  detectBrazilianDocumentKind,
  formatBrazilianDocument,
  isValidBrazilianDocument,
  maskBrazilianDocumentForDisplay,
  maskBrazilianDocumentInput,
  normalizeBrazilianDocument,
} from './brazilianDocument.service'

const CPF = '52998224725'
const CNPJ = '11222333000181'
/** Exemplo oficial do CNPJ alfanumérico (Receita Federal). */
const CNPJ_ALPHANUMERIC = '12ABC34501DE35'

describe('detectBrazilianDocumentKind', () => {
  test('tells CPF from CNPJ by length, with or without mask', () => {
    expect(detectBrazilianDocumentKind(CPF)).toBe('cpf')
    expect(detectBrazilianDocumentKind('529.982.247-25')).toBe('cpf')
    expect(detectBrazilianDocumentKind(CNPJ)).toBe('cnpj')
    expect(detectBrazilianDocumentKind('11.222.333/0001-81')).toBe('cnpj')
  })

  test('accepts letters only in the 12-character CNPJ base', () => {
    expect(detectBrazilianDocumentKind(CNPJ_ALPHANUMERIC)).toBe('cnpj')
    expect(detectBrazilianDocumentKind('12ABC34501DE3A')).toBeUndefined()
    expect(detectBrazilianDocumentKind('5299822472A')).toBeUndefined()
  })

  test('anything else is undefined', () => {
    expect(detectBrazilianDocumentKind('')).toBeUndefined()
    expect(detectBrazilianDocumentKind('1234567890')).toBeUndefined()
    expect(detectBrazilianDocumentKind('123456789012')).toBeUndefined()
  })
})

describe('isValidBrazilianDocument', () => {
  test('checks the verifier digits of both kinds, including the alphanumeric CNPJ', () => {
    expect(isValidBrazilianDocument('529.982.247-25')).toBe(true)
    expect(isValidBrazilianDocument('11.222.333/0001-81')).toBe(true)
    expect(isValidBrazilianDocument('12.abc.345/01de-35')).toBe(true)
  })

  test('refuses wrong digits, repeated digits and wrong size', () => {
    expect(isValidBrazilianDocument('529.982.247-26')).toBe(false)
    expect(isValidBrazilianDocument('11.222.333/0001-82')).toBe(false)
    expect(isValidBrazilianDocument('111.111.111-11')).toBe(false)
    expect(isValidBrazilianDocument('12345')).toBe(false)
  })
})

describe('formatBrazilianDocument / normalizeBrazilianDocument', () => {
  test('formats complete documents', () => {
    expect(formatBrazilianDocument(CPF)).toBe('529.982.247-25')
    expect(formatBrazilianDocument(CNPJ)).toBe('11.222.333/0001-81')
    expect(formatBrazilianDocument(CNPJ_ALPHANUMERIC)).toBe('12.ABC.345/01DE-35')
  })

  test('leaves anything else as it came', () => {
    expect(formatBrazilianDocument('12345')).toBe('12345')
  })

  test('normalize strips only the mask and upper-cases, never the letters', () => {
    expect(normalizeBrazilianDocument('12.abc.345/01de-35')).toBe(CNPJ_ALPHANUMERIC)
    expect(normalizeBrazilianDocument(' 529.982.247-25 ')).toBe(CPF)
  })
})

describe('maskBrazilianDocumentInput (progressive, one field)', () => {
  test('builds the CPF mask while typing', () => {
    expect(maskBrazilianDocumentInput('5')).toBe('5')
    expect(maskBrazilianDocumentInput('5299')).toBe('529.9')
    expect(maskBrazilianDocumentInput('529982')).toBe('529.982')
    expect(maskBrazilianDocumentInput('5299822')).toBe('529.982.2')
    expect(maskBrazilianDocumentInput('52998224725')).toBe('529.982.247-25')
  })

  test('switches to the CNPJ mask on the 12th character', () => {
    expect(maskBrazilianDocumentInput('529982247251')).toBe('52.998.224/7251')
    expect(maskBrazilianDocumentInput('11222333000181')).toBe('11.222.333/0001-81')
  })

  test('letters switch to CNPJ, are upper-cased and only allowed in the base', () => {
    expect(maskBrazilianDocumentInput('12abc')).toBe('12.ABC')
    expect(maskBrazilianDocumentInput('12abc34501de35')).toBe('12.ABC.345/01DE-35')
    expect(maskBrazilianDocumentInput('12abc34501deAB')).toBe('12.ABC.345/01DE')
  })

  test('is idempotent on already-masked text and caps at 14 characters', () => {
    expect(maskBrazilianDocumentInput('11.222.333/0001-81')).toBe('11.222.333/0001-81')
    expect(maskBrazilianDocumentInput('112223330001819999')).toBe('11.222.333/0001-81')
    expect(maskBrazilianDocumentInput('')).toBe('')
  })
})

describe('maskBrazilianDocumentForDisplay', () => {
  test('keeps the last characters and the punctuation', () => {
    expect(maskBrazilianDocumentForDisplay(CPF)).toBe('•••.•••.•47-25')
    expect(maskBrazilianDocumentForDisplay(CNPJ)).toBe('••.•••.•••/••01-81')
  })

  test('visibleCharacters is configurable, 0 hides everything', () => {
    expect(maskBrazilianDocumentForDisplay(CPF, { visibleCharacters: 2 })).toBe('•••.•••.•••-25')
    expect(maskBrazilianDocumentForDisplay(CPF, { visibleCharacters: 0 })).toBe('•••.•••.•••-••')
  })

  test('a value that is not a document hides all but the end, without inventing punctuation', () => {
    expect(maskBrazilianDocumentForDisplay('ABC12345', { visibleCharacters: 3 })).toBe('•••••345')
  })
})
