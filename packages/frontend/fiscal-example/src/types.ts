export type FiscalModel = 'nfce' | 'nfe' | 'sat' | 'nfse' | 'nfse-notarp' | 'cte'
export type FiscalEnvironment = 'homologacao' | 'producao'

export interface ConnectionResult {
  success: boolean
  message: string
  model: string
  environment: string
  code?: string
}

export interface EmitItem {
  codigo: string
  descricao: string
  ncm?: string
  cfop?: string
  cst?: string
  unidade: string
  quantidade: number
  valorUnitario: number
  valorTotal: number
}

export interface EmitPayment {
  method: string
  amount: number
}

export interface EmitResult {
  success: boolean
  chaveAcesso?: string
  protocolo?: string
  numeroDocumento?: number
  serie?: string
  xmlAutorizado?: string
  qrCodeUrl?: string
  danfce?: {
    text: string
    qrCodeUrl: string
    urlConsulta: string
  }
  errorCode?: string
  errorMessage?: string
}

export interface CancelResult {
  success: boolean
  protocoloCancelamento?: string
  xmlEvento?: string
  errorCode?: string
  errorMessage?: string
}

export interface CertificateInfo {
  valid: boolean
  subject: string
  issuer: string
  validFrom: string
  expiresAt: string
  cnpj?: string
  cpf?: string
  hasPrivateKey: boolean
  isExpired: boolean
  isIcpBrasil: boolean
  canSign: boolean
  errors: string[]
  warnings: string[]
}
