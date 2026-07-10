import { fakerPT_BR as faker } from '@faker-js/faker'

export interface FakeEmitente {
  cnpj: string
  razaoSocial: string
  nomeFantasia: string
  ie: string
  crt: '1' | '2' | '3'
  uf: string
  cep: string
  logradouro: string
  numero: string
  bairro: string
  municipio: string
  codigoMunicipio: string
}

export interface FakeNfceExtra {
  csc: string
  cscId: string
}

export interface FakeNfeExtra {
  destCnpj: string
  destNome: string
  destUf: string
  destCep: string
  destLogradouro: string
  destNumero: string
  destBairro: string
  destMunicipio: string
  destCodMun: string
  destIndicadorIe: '1' | '2' | '9'
  naturezaOperacao: string
}

export interface FakeSatExtra {
  satUrl: string
  activationCode: string
  signatureAC: string
}

export interface FakeNfseExtra {
  webserviceUrl: string
  inscricaoMunicipal: string
  codigoServico: string
  aliquotaIss: number
}

export interface FakeProduto {
  codigo: string
  descricao: string
  ncm: string
  cfop: string
  cst: string
  unidade: string
  quantidade: number
  valorUnitario: number
}

const ESTADO_PARA_UF: Record<string, string> = {
  Acre: 'AC',
  Alagoas: 'AL',
  Amapá: 'AP',
  Amazonas: 'AM',
  Bahia: 'BA',
  Ceará: 'CE',
  'Distrito Federal': 'DF',
  'Espírito Santo': 'ES',
  Goiás: 'GO',
  Maranhão: 'MA',
  'Mato Grosso': 'MT',
  'Mato Grosso do Sul': 'MS',
  'Minas Gerais': 'MG',
  Pará: 'PA',
  Paraíba: 'PB',
  Paraná: 'PR',
  Pernambuco: 'PE',
  Piauí: 'PI',
  'Rio de Janeiro': 'RJ',
  'Rio Grande do Norte': 'RN',
  'Rio Grande do Sul': 'RS',
  Rondônia: 'RO',
  Roraima: 'RR',
  'Santa Catarina': 'SC',
  'São Paulo': 'SP',
  Sergipe: 'SE',
  Tocantins: 'TO',
}

const CODIGOS_MUNICIPIO: Record<string, string> = {
  SP: '3550308',
  MG: '3106200',
  RJ: '3304557',
  RS: '4314902',
  PR: '4106902',
  SC: '4205407',
  BA: '2927408',
  PE: '2611606',
  CE: '2304400',
  GO: '5208707',
  DF: '5300108',
  ES: '3205309',
  AM: '1302603',
  PA: '1501402',
  MT: '5103403',
}

const NFCE_UF = ['SP', 'MG', 'RS', 'PR', 'SC', 'RJ', 'BA', 'PE', 'GO', 'DF', 'ES', 'AM', 'PA', 'MT']
const SAT_UF = ['SP', 'CE'] // SAT ainda existe como legado/contingência; CE usa MFE

function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function gerarCnpj(): string {
  const base = faker.string.numeric({ length: 8 }) + '0001'
  const n = base.split('').map(Number)
  const calc = (pesos: number[], arr: number[]) => {
    let sum = 0
    for (let i = 0; i < pesos.length; i++) sum += arr[i] * pesos[i]
    const rest = sum % 11
    return rest < 2 ? 0 : 11 - rest
  }
  const d1 = calc([5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2], n)
  const a2 = [...n, d1]
  const d2 = calc([6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2], a2)
  return [...n, d1, d2].join('')
}

function gerarUf(): string {
  const estado = faker.location.state()
  return ESTADO_PARA_UF[estado] || 'SP'
}

export function gerarEmitente(uf?: string): FakeEmitente {
  const ufVal = uf || gerarUf()
  const codigoMun = CODIGOS_MUNICIPIO[ufVal] || '3550308'
  return {
    cnpj: gerarCnpj(),
    razaoSocial: faker.company.name(),
    nomeFantasia: faker.company.name(),
    ie: faker.string.numeric({ length: { min: 9, max: 14 } }),
    crt: ['1', '2', '3'][rand(0, 2)] as '1' | '2' | '3',
    uf: ufVal,
    cep: faker.location.zipCode().replace(/\D/g, '').slice(0, 8),
    logradouro: faker.location.street(),
    numero: String(rand(1, 9999)),
    bairro: faker.location.county(),
    municipio: faker.location.city(),
    codigoMunicipio: codigoMun,
  }
}

export function gerarNfceExtra(): FakeNfceExtra {
  return {
    csc: faker.string.alphanumeric({ length: 36, casing: 'upper' }),
    cscId: String(rand(1, 9)),
  }
}

export function gerarNfeExtra(): FakeNfeExtra {
  return {
    destCnpj: gerarCnpj(),
    destNome: faker.company.name(),
    destUf: gerarUf(),
    destCep: faker.location.zipCode().replace(/\D/g, '').slice(0, 8),
    destLogradouro: faker.location.street(),
    destNumero: String(rand(1, 9999)),
    destBairro: faker.location.county(),
    destMunicipio: faker.location.city(),
    destCodMun: faker.string.numeric({ length: 7 }),
    destIndicadorIe: ['1', '2', '9'][rand(0, 2)] as '1' | '2' | '9',
    naturezaOperacao: [
      'Venda de mercadoria',
      'Venda de produção do estabelecimento',
      'Remessa para demonstração',
      'Devolução de venda',
    ][rand(0, 3)],
  }
}

export function gerarSatExtra(): FakeSatExtra {
  return {
    // Porta padrão do middleware Control-ID / SAT (não randomizar — senão a emissão falha)
    satUrl: 'http://localhost:9090',
    activationCode: faker.string.numeric({ length: 8 }),
    signatureAC: faker.string.alphanumeric({ length: 32, casing: 'upper' }),
  }
}

export function gerarNfseExtra(): FakeNfseExtra {
  return {
    webserviceUrl: 'https://nfse.municipio.gov.br/ws',
    inscricaoMunicipal: faker.string.numeric({ length: { min: 6, max: 12 } }),
    codigoServico: faker.string.numeric({ length: { min: 4, max: 8 } }),
    aliquotaIss: [2, 3, 5][rand(0, 2)],
  }
}

export function gerarProduto(index = 1): FakeProduto {
  const valor = parseFloat((Math.random() * 200 + 5).toFixed(2))
  return {
    codigo: `00${String(index)}`,
    descricao: faker.commerce.productName(),
    ncm: faker.string.numeric({ length: 8 }),
    cfop: ['5101', '5102', '5405', '5929', '6101', '6102'][rand(0, 5)],
    cst: ['00', '40', '60', '102'][rand(0, 3)],
    unidade: ['UN', 'KG', 'L', 'CX', 'PC'][rand(0, 4)],
    quantidade: rand(1, 10),
    valorUnitario: valor,
  }
}

export function getNfceUf(): string {
  return NFCE_UF[rand(0, NFCE_UF.length - 1)]
}

export function getSatUf(): string {
  return SAT_UF[rand(0, SAT_UF.length - 1)]
}
