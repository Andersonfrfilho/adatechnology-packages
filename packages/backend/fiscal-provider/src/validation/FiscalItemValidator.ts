import type { FiscalItem } from '../types'
import { FiscalValidationError } from '../errors/FiscalError'

/** Primeiro dígito do CFOP indica a natureza da operação — nenhum CFOP real começa fora deste conjunto. */
const CFOP_PRIMEIRO_DIGITO_VALIDO = new Set(['1', '2', '3', '5', '6', '7'])

/** CSOSN válidos para CRT 1/2 (Simples Nacional). */
const CSOSN_VALIDOS = new Set(['101', '102', '103', '201', '202', '203', '300', '400', '500', '900'])

/** CST de ICMS válidos para CRT 3 (Regime Normal). */
const CST_ICMS_VALIDOS = new Set(['00', '10', '20', '30', '40', '41', '50', '51', '60', '61', '70', '90'])

type AssertValidFiscalItemsParams = {
  readonly items: readonly FiscalItem[]
  readonly crt: string
}

/**
 * Valida NCM/CFOP/CST antes da montagem do XML. Isso pega formato inválido e placeholders
 * óbvios (ex: NCM '00000000', gerado por engano por um faker/mock) — não garante que o NCM
 * exista na Tabela NCM oficial, pois essa tabela (~10 mil códigos) não é distribuída com o SDK.
 */
export function assertValidFiscalItems({ items, crt }: AssertValidFiscalItemsParams): void {
  items.forEach((item, index) => {
    const nItem = index + 1
    assertValidNcm(item.ncm, nItem)
    assertValidCfop(item.cfop, nItem)
    assertValidCst({ cst: item.cst, crt, nItem })
  })
}

export function assertValidNcm(ncm: string, nItem: number): void {
  const digits = (ncm ?? '').replace(/\D/g, '')
  if (digits.length !== 8) {
    throw new FiscalValidationError(`NCM inválido no item ${nItem}: "${ncm}" deve ter 8 dígitos`, {
      field: 'ncm',
      nItem,
      value: ncm,
    })
  }
  if (/^(\d)\1{7}$/.test(digits)) {
    throw new FiscalValidationError(
      `NCM inválido no item ${nItem}: "${ncm}" parece um valor de preenchimento (todos os dígitos iguais) — informe um NCM real da Tabela NCM (https://www.siscomex.gov.br/tabelas/ncm/)`,
      { field: 'ncm', nItem, value: ncm },
    )
  }
}

export function assertValidCfop(cfop: string, nItem: number): void {
  const digits = (cfop ?? '').replace(/\D/g, '')
  if (digits.length !== 4) {
    throw new FiscalValidationError(`CFOP inválido no item ${nItem}: "${cfop}" deve ter 4 dígitos`, {
      field: 'cfop',
      nItem,
      value: cfop,
    })
  }
  if (!CFOP_PRIMEIRO_DIGITO_VALIDO.has(digits[0] ?? '')) {
    throw new FiscalValidationError(
      `CFOP inválido no item ${nItem}: "${cfop}" — primeiro dígito deve ser 1, 2, 3, 5, 6 ou 7`,
      { field: 'cfop', nItem, value: cfop },
    )
  }
}

type AssertValidCstParams = {
  readonly cst: string
  readonly crt: string
  readonly nItem: number
}

function assertValidCst({ cst, crt, nItem }: AssertValidCstParams): void {
  const code = (cst ?? '').replace(/\D/g, '')
  const isSimplesNacional = crt === '1' || crt === '2'
  const validCodes = isSimplesNacional ? CSOSN_VALIDOS : CST_ICMS_VALIDOS
  const label = isSimplesNacional ? 'CSOSN' : 'CST'

  if (!validCodes.has(code)) {
    throw new FiscalValidationError(
      `${label} inválido no item ${nItem}: "${cst}" não é um código reconhecido para CRT=${crt}`,
      { field: 'cst', nItem, value: cst, crt },
    )
  }
}
