export type FiscalModel = 'sat' | 'nfce'

export type FiscalEnvironment = 'homologacao' | 'producao'

export type PaymentMethod = 'pix' | 'card_credit' | 'card_debit' | 'cash' | 'voucher'

export type FiscalConfigBase = {
  readonly model: FiscalModel
  readonly environment: FiscalEnvironment
  readonly cnpj: string
  readonly inscricaoEstadual: string
  readonly razaoSocial: string
  readonly uf: string
  readonly municipio: string
  readonly cep: string
  readonly logradouro: string
  readonly numero: string
  readonly bairro: string
  readonly complemento?: string
  readonly crt: '1' | '2' | '3'
}

export type NfceConfig = FiscalConfigBase & {
  readonly model: 'nfce'
  readonly certificadoBase64: string
  readonly certificadoSenha: string
  readonly serie: string
  readonly numeroNf: number
  readonly codigoMunicipio: string
  readonly telefone?: string
}

export type SatConfig = FiscalConfigBase & {
  readonly model: 'sat'
  readonly satUrl: string
  readonly activationCode: string
  readonly signatureAC: string
}

export type FiscalConfig = NfceConfig | SatConfig

export type FiscalItem = {
  readonly codigo: string
  readonly descricao: string
  readonly ncm: string
  readonly cfop: string
  readonly cst: string
  readonly unidade: string
  readonly quantidade: number
  readonly valorUnitario: number
  readonly valorTotal: number
}

export type FiscalPayment = {
  readonly method: PaymentMethod
  readonly amount: number
}

export type EmitFiscalParams = {
  readonly referenceId: string
  readonly items: FiscalItem[]
  readonly payments: FiscalPayment[]
  readonly totalAmount: number
  readonly discountAmount: number
  readonly customerCpf?: string
  readonly config: FiscalConfig
}

export type CancelFiscalParams = {
  readonly chaveAcesso: string
  readonly justificativa: string
  readonly config: FiscalConfig
}

export type TestConnectionParams = {
  readonly config: FiscalConfig
}

export type FiscalResult = {
  readonly success: boolean
  readonly chaveAcesso?: string
  readonly protocolo?: string
  readonly numeroDocumento?: number
  readonly serie?: string
  readonly xmlAutorizado?: string
  readonly qrCodeUrl?: string
  readonly danfePdfUrl?: string
  readonly errorCode?: string
  readonly errorMessage?: string
  readonly rawResponse: unknown
}

export type TestConnectionResult = {
  readonly ok: boolean
  readonly message: string
}
