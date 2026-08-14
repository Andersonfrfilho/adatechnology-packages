import { UF_IBGE_CODES } from './SefazConstants'
import { toBrasiliaWallClock } from './SefazDateTime'
import { CHAVE_PATTERN, CNPJ_PATTERN, calcularDvChave, normalizeTaxId } from './SefazTaxId'

type BuildChaveParams = {
  readonly uf: string
  readonly dataEmissao: Date
  readonly cnpj: string
  readonly serie: string
  readonly numeroNf: number
  readonly mod?: '55' | '65'
}

export type ChaveAcesso = {
  readonly chave: string
  readonly cNF: string
  readonly id: string
}

export function buildChaveAcesso(params: BuildChaveParams): ChaveAcesso {
  const cUF = UF_IBGE_CODES[params.uf]
  if (!cUF) throw new Error(`UF desconhecida: ${params.uf}`)

  const wallClock = toBrasiliaWallClock(params.dataEmissao)
  const year = wallClock.getUTCFullYear().toString().slice(-2)
  const month = (wallClock.getUTCMonth() + 1).toString().padStart(2, '0')
  const AAMM = `${year}${month}`

  const cnpj = normalizeTaxId(params.cnpj)
  // Sem padStart: CNPJ que não fecha 14 posições é erro de cadastro, não valor a completar com zero
  if (!CNPJ_PATTERN.test(cnpj)) throw new Error(`CNPJ inválido para a chave de acesso: ${params.cnpj}`)
  const mod = params.mod ?? '65'
  const serie = params.serie.padStart(3, '0')
  const nNF = params.numeroNf.toString().padStart(9, '0')
  const tpEmis = '1'
  const cNF = generateRandomCode()

  const chave43 = `${cUF}${AAMM}${cnpj}${mod}${serie}${nNF}${tpEmis}${cNF}`
  const cDV = calcularDvChave(chave43)
  const chave = `${chave43}${cDV}`

  return { chave, cNF, id: `NFe${chave}` }
}

/** Valida o dígito verificador (mód. 11) de uma chave de acesso de 44 posições. */
export function isChaveDvValid(chave: string): boolean {
  const clean = normalizeTaxId(chave)
  if (!CHAVE_PATTERN.test(clean)) return false
  return calcularDvChave(clean.slice(0, 43)) === clean[43]
}

function generateRandomCode(): string {
  return Math.floor(Math.random() * 99_999_999)
    .toString()
    .padStart(8, '0')
}
