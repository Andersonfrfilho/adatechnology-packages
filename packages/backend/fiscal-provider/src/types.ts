export const FiscalModel = {
  NFCE:        'nfce',
  NFE:         'nfe',
  SAT:         'sat',
  NFSE:        'nfse',
  NFSE_NOTARP: 'nfse-notarp',
} as const
export type FiscalModel = (typeof FiscalModel)[keyof typeof FiscalModel]

export const FiscalEnvironment = {
  HOMOLOGACAO: 'homologacao',
  PRODUCAO:    'producao',
} as const
export type FiscalEnvironment = (typeof FiscalEnvironment)[keyof typeof FiscalEnvironment]

export const PaymentMethod = {
  PIX:         'pix',
  CARD_CREDIT: 'card_credit',
  CARD_DEBIT:  'card_debit',
  CASH:        'cash',
  VOUCHER:     'voucher',
} as const
export type PaymentMethod = (typeof PaymentMethod)[keyof typeof PaymentMethod]

export type FiscalConfigBase = {
  readonly model: FiscalModel
  /** 'homologacao' para testes | 'producao' para uso real */
  readonly environment: FiscalEnvironment
  /** CNPJ sem formatação — exatamente como está no certificado A1 */
  readonly cnpj: string
  /**
   * Inscrição Estadual do emitente.
   * - String de dígitos sem pontos/traços (ex: '110042490114' para SP).
   * - Passe string vazia '' para gerar <IE>ISENTO</IE> (Simples Nacional sem IE estadual).
   */
  readonly inscricaoEstadual: string
  readonly razaoSocial: string
  /** Sigla da UF do emitente — ex: 'SP', 'MG', 'RJ' */
  readonly uf: string
  readonly municipio: string
  readonly cep: string
  readonly logradouro: string
  readonly numero: string
  readonly bairro: string
  readonly complemento?: string
  /**
   * Código de Regime Tributário:
   * - '1' = Simples Nacional
   * - '2' = Simples Nacional — excesso de sublimite de receita bruta
   * - '3' = Regime Normal (Lucro Real / Lucro Presumido)
   */
  readonly crt: '1' | '2' | '3'
}

export type NfceConfig = FiscalConfigBase & {
  readonly model: 'nfce'
  /** Certificado A1 em base64 — gerado com: base64 -i certificado.pfx */
  readonly certificadoBase64: string
  readonly certificadoSenha: string
  /**
   * Série da NFC-e/NF-e — sem zeros à esquerda (SEFAZ rejeita '001').
   * Use '1', '2', etc.
   */
  readonly serie: string
  readonly numeroNf: number
  /** Código IBGE de 7 dígitos do município do emitente — ex: '3550308' (São Paulo) */
  readonly codigoMunicipio: string
  readonly telefone?: string
  /** ID do CSC (Código de Segurança do Contribuinte) — obtido no portal SEFAZ do estado */
  readonly cscId: string
  /** Token CSC — obtido no portal SEFAZ do estado junto com cscId */
  readonly cscToken: string
}

export type SatConfig = FiscalConfigBase & {
  readonly model: 'sat'
  /** URL do middleware SAT rodando localmente — ex: 'http://localhost:8080/sat' */
  readonly satUrl: string
  readonly activationCode: string
  readonly signatureAC: string
}

export type NfeDestinatario = {
  /** CNPJ do destinatário — use para operações B2B (pessoa jurídica) */
  readonly cnpj?: string
  /** CPF do destinatário — use para operações B2C (consumidor final) */
  readonly cpf?: string
  /**
   * Razão social ou nome do destinatário.
   * Em ambiente de homologação, o builder substitui automaticamente pelo nome
   * obrigatório do SEFAZ ('NF-E EMITIDA EM AMBIENTE DE HOMOLOGACAO...').
   * Em produção, use o nome real.
   */
  readonly xNome: string
  /** Código IBGE de 7 dígitos do município do destinatário */
  readonly codigoMunicipio: string
  readonly cep: string
  readonly logradouro: string
  readonly numero: string
  readonly complemento?: string
  readonly bairro: string
  readonly municipio: string
  /** Sigla da UF do destinatário — ex: 'SP' */
  readonly uf: string
  readonly telefone?: string
  readonly email?: string
  readonly inscricaoEstadual?: string
  /**
   * Indicador da IE do destinatário:
   * - '1' = Contribuinte ICMS (tem IE — obrigatório informar inscricaoEstadual)
   * - '2' = Contribuinte isento de inscrição no ICMS
   * - '9' = Não contribuinte (consumidor final com CPF — use sempre '9' para PF)
   */
  readonly indicadorIe: '1' | '2' | '9'
}

export type NfeData = {
  readonly destinatario: NfeDestinatario
  /** Descrição da operação — ex: 'Venda de mercadoria'. Padrão: 'Venda de mercadoria' */
  readonly naturezaOperacao?: string
  /**
   * Finalidade da NF-e:
   * - '1' = NF-e normal (padrão)
   * - '2' = NF-e complementar
   * - '3' = NF-e de ajuste
   * - '4' = Devolução de mercadoria
   */
  readonly finalidade?: '1' | '2' | '3' | '4'
  /**
   * Destino da operação (calculado automaticamente quando omitido):
   * - '1' = Operação interna (emitente e destinatário na mesma UF)
   * - '2' = Operação interestadual
   * - '3' = Operação com exterior
   */
  readonly destinoOperacao?: '1' | '2' | '3'
  /**
   * Indicador de operação com consumidor final:
   * - '0' = Normal (operação B2B)
   * - '1' = Consumidor final (operação B2C — padrão quando há CPF)
   */
  readonly indFinal?: '0' | '1'
  /** Informações adicionais que aparecem no DANFE */
  readonly informacoesAdicionais?: string
}

export type NfseData = {
  readonly discriminacao: string
  readonly competencia: string
  readonly tomadorCnpj?: string
  readonly tomadorCpf?: string
  readonly tomadorRazaoSocial?: string
  readonly tomadorEmail?: string
  readonly tomadorInscricaoMunicipal?: string
  readonly nfseSubstituida?: string
}

export type NfeConfig = FiscalConfigBase & {
  readonly model: 'nfe'
  /** Certificado A1 em base64 — gerado com: base64 -i certificado.pfx */
  readonly certificadoBase64: string
  readonly certificadoSenha: string
  /**
   * Série da NF-e — sem zeros à esquerda (SEFAZ rejeita '001', use '1').
   * Série 1 é a padrão para a maioria dos emitentes.
   */
  readonly serie: string
  readonly numeroNf: number
  /** Código IBGE de 7 dígitos do município do emitente — ex: '3543402' (Ribeirão Preto) */
  readonly codigoMunicipio: string
  readonly telefone?: string
}

export type NfseConfig = FiscalConfigBase & {
  readonly model: 'nfse'
  readonly certificadoBase64: string
  readonly certificadoSenha: string
  /** URL do webservice ABRASF do município — consulte a prefeitura ou portal ISS municipal */
  readonly webserviceUrl: string
  readonly inscricaoMunicipal: string
  readonly codigoMunicipio: string
  /** Código do serviço conforme lista da LC 116/2003 — ex: '0105' */
  readonly codigoServico: string
  /** Alíquota ISS em decimal — ex: 5.0 para 5% */
  readonly aliquotaIss: number
  readonly issRetido: boolean
}

export type NotaRpConfig = {
  readonly model: 'nfse-notarp'
  readonly environment: FiscalEnvironment
  readonly cnpj: string
  readonly razaoSocial: string
  readonly inscricaoMunicipal: string
  readonly apiToken: string
  readonly baseUrl?: string  // padrão https://www.notarp.com.br — trocar para v2 quando RP for suportado
}

export type NotaRpTomador = {
  readonly documento?: string         // CNPJ ou CPF sem formatação
  readonly nome?: string
  readonly email?: string
  readonly telefone?: string
  readonly pais?: string              // padrão 'BR'
  readonly cep?: string
  readonly estado?: string
  readonly cidade?: string
  readonly bairro?: string
  readonly endereco?: string
  readonly numero?: string
}

export type NotaRpNfseData = {
  readonly descricao: string
  readonly valorTotal: number
  readonly codigoTributacaoNacional: string    // ex: '0105'
  readonly codigoTributacaoMunicipal: string   // ex: '010501'
  readonly codigoNbs: string                   // ex: '1.0501'
  readonly dataCompetencia: string             // DD/MM/YYYY
  readonly municipio: string                   // código IBGE 7 dígitos
  readonly aliquotaIssqn: number
  readonly incidenciaIssqn?: string            // padrão 'operacao_tributavel'
  readonly issqnRetido?: boolean
  readonly regimeEspecialTributacao?: string   // padrão 'nenhum'
  readonly informacoesComplementares?: string
  readonly descontoIncondicionado?: number
  readonly descontoCondicionado?: number
  readonly cstPisCofins?: string               // padrão 'aliquota_basica'
  readonly aliquotaPis?: number                // padrão 0.65
  readonly aliquotaCofins?: number             // padrão 3.00
  readonly pisRetido?: boolean
  readonly cofinsRetido?: boolean
  readonly aliquotaSimplesNacional?: number
  readonly ibscbs?: {
    readonly cst: string
    readonly classtrib: string
    readonly indop: string
  }
  readonly tomador?: NotaRpTomador
  readonly hashPedido?: string                 // chave de idempotência
  readonly webhookUrl?: string
  readonly enviarEmail?: boolean
}

export type FiscalConfig = NfceConfig | NfeConfig | SatConfig | NfseConfig | NotaRpConfig

export type FiscalItem = {
  /** Código interno do produto */
  readonly codigo: string
  readonly descricao: string
  /**
   * Código NCM (Nomenclatura Comum do Mercosul) — 8 dígitos.
   * Consulte: https://www.siscomex.gov.br/tabelas/ncm/
   * Ex: '84713012' (computadores portáteis), '22021000' (água com gás)
   */
  readonly ncm: string
  /**
   * CFOP — Código Fiscal de Operações e Prestações — 4 dígitos.
   * Mais usados:
   * - '5102' = Venda de mercadoria adquirida de terceiros (dentro do estado)
   * - '6102' = Venda de mercadoria adquirida de terceiros (outro estado)
   * - '5101' = Venda de produção própria (dentro do estado)
   */
  readonly cfop: string
  /**
   * CST/CSOSN — Código de Situação Tributária do ICMS.
   * Depende do CRT:
   * - CRT=1 (Simples Nacional): use CSOSN → '101','102','103','300','400','500','900'
   *   Mais comum: '500' (sem débito de ICMS — mercadoria já tributada na entrada)
   * - CRT=3 (Regime Normal): use CST → '00','10','20','40','41','50','51','60','70','90'
   *   Mais comum: '00' (tributado integralmente), '40' (isento), '41' (não tributado)
   */
  readonly cst: string
  /** Unidade de medida — ex: 'UN', 'KG', 'CX', 'LT', 'MT' */
  readonly unidade: string
  readonly quantidade: number
  readonly valorUnitario: number
  /** Deve ser exatamente quantidade * valorUnitario (com arredondamento de centavos) */
  readonly valorTotal: number
}

export type FiscalPayment = {
  readonly method: PaymentMethod
  readonly amount: number
}

export type EmitFiscalParams = {
  /** ID de rastreio da operação — aparece nos logs para debugging */
  readonly referenceId: string
  readonly items: FiscalItem[]
  readonly payments: FiscalPayment[]
  readonly totalAmount: number
  readonly discountAmount: number
  readonly customerCpf?: string
  readonly config: FiscalConfig
  /** Dados adicionais obrigatórios para NFS-e ABRASF */
  readonly nfseData?: NfseData
  /** Dados adicionais obrigatórios para NF-e (modelo 55) */
  readonly nfeData?: NfeData
  /** Dados adicionais obrigatórios para NFS-e NotaRP */
  readonly notaRpNfseData?: NotaRpNfseData
}

export type NfseCancelCode = '1' | '2' | '3' | '4' | '5'

export type CancelFiscalParams = {
  /** Chave de acesso de 44 dígitos retornada pelo emit() */
  readonly chaveAcesso: string
  /** Protocolo de autorização retornado pelo emit() — obrigatório para NF-e/NFC-e */
  readonly protocolo?: string
  /** Justificativa de cancelamento — mínimo 15 caracteres (exigência SEFAZ) */
  readonly justificativa: string
  readonly codigoCancelamento?: NfseCancelCode
  readonly config: FiscalConfig
}

export type TestConnectionParams = {
  readonly config: FiscalConfig
}

export type DanfceData = {
  readonly text: string
  readonly qrCodeUrl: string
  readonly urlConsulta: string
}

export type FiscalResult = {
  readonly success: boolean
  /** Chave de acesso de 44 dígitos — guardar para cancelamento e consulta */
  readonly chaveAcesso?: string
  /** Protocolo de autorização — obrigatório para cancelamento */
  readonly protocolo?: string
  readonly numeroDocumento?: number
  readonly serie?: string
  readonly xmlAutorizado?: string
  readonly qrCodeUrl?: string
  readonly danfce?: DanfceData
  readonly danfePdfUrl?: string
  /** Código cStat da SEFAZ — ex: '100' autorizado, '225' falha schema, '209' IE inválida */
  readonly errorCode?: string
  readonly errorMessage?: string
  readonly rawResponse: unknown
}

export type TestConnectionResult = {
  readonly ok: boolean
  readonly message: string
}
