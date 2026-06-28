import { UF_IBGE_CODES } from './SefazConstants'

type BuildChaveParams = {
  readonly uf: string
  readonly dataEmissao: Date
  readonly cnpj: string
  readonly serie: string
  readonly numeroNf: number
}

export type ChaveAcesso = {
  readonly chave: string
  readonly cNF: string
  readonly id: string
}

export function buildChaveAcesso(params: BuildChaveParams): ChaveAcesso {
  const cUF = UF_IBGE_CODES[params.uf]
  if (!cUF) throw new Error(`UF desconhecida: ${params.uf}`)

  const year = params.dataEmissao.getFullYear().toString().slice(-2)
  const month = (params.dataEmissao.getMonth() + 1).toString().padStart(2, '0')
  const AAMM = `${year}${month}`

  const cnpj = params.cnpj.replace(/\D/g, '').padStart(14, '0')
  const mod = '65'
  const serie = params.serie.padStart(3, '0')
  const nNF = params.numeroNf.toString().padStart(9, '0')
  const tpEmis = '1'
  const cNF = generateRandomCode()

  const chave43 = `${cUF}${AAMM}${cnpj}${mod}${serie}${nNF}${tpEmis}${cNF}`
  const cDV = calculateModulo11(chave43)
  const chave = `${chave43}${cDV}`

  return { chave, cNF, id: `NFe${chave}` }
}

function generateRandomCode(): string {
  return Math.floor(Math.random() * 99_999_999).toString().padStart(8, '0')
}

// Módulo 11 conforme manual da NF-e (pesos 2–9 ciclando da direita para a esquerda)
function calculateModulo11(digits: string): string {
  const weights = [2, 3, 4, 5, 6, 7, 8, 9]
  let sum = 0
  let weightIndex = 0

  for (let i = digits.length - 1; i >= 0; i--) {
    sum += parseInt(digits[i]!) * weights[weightIndex % 8]!
    weightIndex++
  }

  const remainder = sum % 11
  return remainder < 2 ? '0' : String(11 - remainder)
}
