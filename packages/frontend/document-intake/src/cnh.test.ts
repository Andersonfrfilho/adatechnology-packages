import { describe, expect, test } from 'bun:test'

import { extractCnhFields } from './cnh.service'

/** O texto que o Tesseract devolve de uma CNH-e: rótulos em caixa alta, uma linha por campo. */
const CNH_TEXT = [
  'REPUBLICA FEDERATIVA DO BRASIL',
  'NOME MARIA DE SOUSA',
  'CPF 111.444.777-35',
  'N REGISTRO 01234567890',
  'CAT. HAB: AD',
].join('\n')

describe('extração de campos da CNH', () => {
  test('lê nome, registro e categoria de um texto de OCR', () => {
    expect(extractCnhFields(CNH_TEXT)).toEqual({
      licenseCategory: 'AD',
      licenseNumber: '01234567890',
      name: 'Maria De Sousa',
    })
  })

  /**
   * O CPF tem onze dígitos e vem impresso **antes** do registro na CNH-e. Ancorar no formato faria
   * o CPF virar "a CNH", e a conferência acusaria divergência num documento correto.
   */
  test('não confunde o CPF com o registro, mesmo ele vindo antes e com onze dígitos', () => {
    const withoutLabel = 'NOME MARIA DE SOUSA\nCPF 11144477735\n'

    expect(extractCnhFields(withoutLabel).licenseNumber).toBeNull()
    expect(extractCnhFields(CNH_TEXT).licenseNumber).toBe('01234567890')
  })

  test('categoria fora do catálogo do CONTRAN vira ausência, não valor', () => {
    expect(extractCnhFields('CAT. HAB: ZZ').licenseCategory).toBeNull()
  })

  /** Engolir a linha seguinte inteira seria pior que não achar nada. */
  test('o nome para no fim da linha do rótulo', () => {
    const text = 'NOME MARIA DE SOUSA\nFILIACAO JOAO DE SOUSA\n'

    expect(extractCnhFields(text).name).toBe('Maria De Sousa')
  })

  test('texto que não é CNH devolve tudo nulo, sem inventar campo', () => {
    expect(extractCnhFields('conta de luz, valor total 189,90')).toEqual({
      licenseCategory: null,
      licenseNumber: null,
      name: null,
    })
  })
})
