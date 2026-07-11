export const FiscalModel = {
  NFCE: 'nfce',
  NFE: 'nfe',
  SAT: 'sat',
  NFSE: 'nfse',
  NFSE_NOTARP: 'nfse-notarp',
  CTE: 'cte',
  NFE_DISTRIBUICAO: 'nfe-distribuicao',
} as const
export type FiscalModel = (typeof FiscalModel)[keyof typeof FiscalModel]

export const FiscalEnvironment = {
  HOMOLOGACAO: 'homologacao',
  PRODUCAO: 'producao',
} as const
export type FiscalEnvironment = (typeof FiscalEnvironment)[keyof typeof FiscalEnvironment]

export const PaymentMethod = {
  PIX: 'pix',
  CARD_CREDIT: 'card_credit',
  CARD_DEBIT: 'card_debit',
  CASH: 'cash',
  VOUCHER: 'voucher',
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
  /**
   * Reforma Tributária (NT 2025.002) — sobrescreve os defaults de transição do grupo IBS/CBS.
   * Deixe indefinido para usar CST 000 e as alíquotas simbólicas da fase de teste (IBS 0,1% / CBS 0,9%).
   */
  readonly ibsCbs?: {
    readonly cst?: string
    readonly classTrib?: string
    readonly pIbsUf?: number
    readonly pIbsMun?: number
    readonly pCbs?: number
  }
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
  readonly baseUrl?: string // padrão https://www.notarp.com.br — trocar para v2 quando RP for suportado
}

export type NotaRpTomador = {
  readonly documento?: string // CNPJ ou CPF sem formatação
  readonly nome?: string
  readonly email?: string
  readonly telefone?: string
  readonly pais?: string // padrão 'BR'
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
  readonly codigoTributacaoNacional: string // ex: '0105'
  readonly codigoTributacaoMunicipal: string // ex: '010501'
  readonly codigoNbs: string // ex: '1.0501'
  readonly dataCompetencia: string // DD/MM/YYYY
  readonly municipio: string // código IBGE 7 dígitos
  readonly aliquotaIssqn: number
  readonly incidenciaIssqn?: string // padrão 'operacao_tributavel'
  readonly issqnRetido?: boolean
  readonly regimeEspecialTributacao?: string // padrão 'nenhum'
  readonly informacoesComplementares?: string
  readonly descontoIncondicionado?: number
  readonly descontoCondicionado?: number
  readonly cstPisCofins?: string // padrão 'aliquota_basica'
  readonly aliquotaPis?: number // padrão 0.65
  readonly aliquotaCofins?: number // padrão 3.00
  readonly pisRetido?: boolean
  readonly cofinsRetido?: boolean
  readonly aliquotaSimplesNacional?: number
  readonly ibscbs?: {
    readonly cst: string
    readonly classtrib: string
    readonly indop: string
  }
  readonly tomador?: NotaRpTomador
  readonly hashPedido?: string // chave de idempotência
  readonly webhookUrl?: string
  readonly enviarEmail?: boolean
}

// ─── CT-e — Conhecimento de Transporte Eletrônico (modelo 57) ────────────────

export const CteModal = {
  RODOVIARIO: '01',
  AEREO: '02',
  AQUAVIARIO: '03',
  FERROVIARIO: '04',
  DUTOVIARIO: '05',
} as const
export type CteModal = (typeof CteModal)[keyof typeof CteModal]

export const CteTipoServico = {
  NORMAL: '0',
  SUBCONTRATACAO: '1',
  REDESPACHO: '2',
  REDESPACHO_INTERMEDIARIO: '3',
  SEM_DESEMPENHO: '4',
} as const
export type CteTipoServico = (typeof CteTipoServico)[keyof typeof CteTipoServico]

export const CteTomador = {
  REMETENTE: '0',
  EXPEDIDOR: '1',
  RECEBEDOR: '2',
  DESTINATARIO: '3',
} as const
export type CteTomador = (typeof CteTomador)[keyof typeof CteTomador]

export type CteParticipante = {
  readonly cnpj?: string
  readonly cpf?: string
  readonly ie?: string
  readonly xNome: string
  readonly xFant?: string
  readonly xLgr: string
  readonly nro: string
  readonly xCpl?: string
  readonly xBairro: string
  readonly cMun: string
  readonly xMun: string
  readonly uf: string
  readonly cep?: string
  readonly fone?: string
  readonly email?: string
}

export type CteMunicipio = {
  readonly codigo: string
  readonly nome: string
  readonly uf: string
}

/** Componente de custo do frete (ex: frete, pedágio, despacho) */
export type CteComponenteValor = {
  readonly xNome: string
  readonly vComp: number
}

/** Quantidade de carga transportada */
export type CteQuantidadeCarga = {
  /** '00'=m3, '01'=kg, '02'=ton, '03'=unidade, '04'=litros */
  readonly cUnid: '00' | '01' | '02' | '03' | '04'
  readonly tpMed: string
  readonly qCarga: number
}

/** NF-e vinculada ao CT-e */
export type CteDocumentoNfe = {
  readonly tipo: 'nfe'
  readonly chave: string
  readonly pin?: string
  /** Informações de produto perigoso */
  readonly peri?: ReadonlyArray<{
    readonly nONU: string
    readonly xNomeAE: string
    readonly xClaRisco: string
    readonly grEmb: string
    readonly qTotProd: string
    readonly qVolTipo: string
  }>
}

/** Outros documentos (nota manual, fatura, etc.) */
export type CteDocumentoOutro = {
  readonly tipo: 'outro'
  readonly tpDoc: '00' | '10' | '59' | '65' | '99'
  readonly descOutros?: string
  readonly numero?: string
  readonly valor?: number
  readonly data?: string
}

export type CteDocumento = CteDocumentoNfe | CteDocumentoOutro

// ─── Dados específicos por modal ──────────────────────────────────────────────

export type CteRodoviarioData = {
  readonly modal: '01'
  /** RNTRC — Registro Nacional de Transportadores Rodoviários de Cargas */
  readonly rntrc: string
  readonly veicTracao?: {
    readonly cInt?: string
    readonly placa: string
    readonly RENAVAM?: string
    readonly tara: number
    readonly capKG?: number
    readonly capM3?: number
    readonly tpProp: '0' | '1' | '2' | '3'
    readonly tpVeic: string
    readonly tpRod: string
    readonly tpCar: string
    readonly UF: string
  }
  readonly motoristas?: ReadonlyArray<{ readonly CPF: string; readonly xNome: string }>
  readonly CIOT?: string
  readonly contratante?: { readonly CNPJ?: string; readonly CPF?: string; readonly xNome: string }
}

export type CteAereoData = {
  readonly modal: '02'
  readonly nMinu: string
  readonly nOCA: string
  readonly dPrev: string
  readonly natCarga: { readonly xDime?: string; readonly cInfManu: readonly string[] }
  readonly tarifa: {
    readonly CL: 'G' | 'U'
    readonly cTar?: string
    readonly vTar: number
  }
  readonly peri?: ReadonlyArray<{
    readonly nONU: string
    readonly qTotProd: string
    readonly qVolTipo: string
  }>
}

export type CteAquaviarioData = {
  readonly modal: '03'
  readonly irin: string
  readonly tpNav: '0' | '1'
  readonly balsa?: ReadonlyArray<{
    readonly xBalsa: string
    readonly nViag?: string
    readonly cEmbar: string
    readonly xEmbar: string
  }>
  readonly detCont?: ReadonlyArray<{
    readonly nCont: string
    readonly lacre?: ReadonlyArray<{ readonly nLacre: string }>
    readonly infSucatan?: ReadonlyArray<{ readonly nSucatan: string }>
  }>
}

export type CteFerroviarioData = {
  readonly modal: '04'
  readonly tpTraf: '0' | '1' | '2' | '3'
  readonly ferrEmi?: {
    readonly CNPJ: string
    readonly cInt?: string
    readonly IE: string
    readonly xNome: string
    readonly fluxo: string
  }
  readonly vagao?: ReadonlyArray<{
    readonly serie: string
    readonly nVag: string
    readonly nSeq: number
    readonly TU: number
  }>
}

export type CteModalData = CteRodoviarioData | CteAereoData | CteAquaviarioData | CteFerroviarioData

export type CteIcms =
  | { readonly cst: '00'; readonly vBC: number; readonly pICMS: number; readonly vICMS: number }
  | {
      readonly cst: '20'
      readonly pRedBC: number
      readonly vBC: number
      readonly pICMS: number
      readonly vICMS: number
    }
  | { readonly cst: '40' | '41' | '51' }
  | { readonly cst: '60'; readonly vBCSTRet: number; readonly pICMSSTRet: number; readonly vICMSSTRet: number }
  | { readonly cst: '90'; readonly vBC?: number; readonly pICMS?: number; readonly vICMS?: number }

export type CteData = {
  readonly cfop: string
  readonly naturezaOperacao: string
  readonly tipoServico: CteTipoServico
  readonly municipioOrigem: CteMunicipio
  readonly municipioDestino: CteMunicipio
  readonly tomador: CteTomador
  readonly remetente: CteParticipante
  readonly destinatario: CteParticipante
  readonly expedidor?: CteParticipante
  readonly recebedor?: CteParticipante
  readonly valorTotalPrestacao: number
  readonly valorTotalReceber: number
  readonly componentesValor: readonly CteComponenteValor[]
  readonly icms: CteIcms
  readonly carga: {
    readonly vCarga: number
    readonly proPred: string
    readonly xOutCat?: string
    readonly quantidades: readonly CteQuantidadeCarga[]
  }
  readonly documentos: readonly CteDocumento[]
  readonly modal: CteModalData
  readonly informacoesAdicionais?: string
  readonly observacoes?: string
}

export type CteConfig = FiscalConfigBase & {
  readonly model: 'cte'
  readonly certificadoBase64: string
  readonly certificadoSenha: string
  readonly serie: string
  readonly numeroCte: number
  readonly codigoMunicipio: string
  /** RNTRC — Registro Nacional de Transportadores Rodoviários de Cargas */
  readonly rntrc: string
  readonly telefone?: string
}

// ─── NF-e Distribuição DFe — consulta por CNPJ do interessado ─────────────────

export type NfeDistribuicaoConfig = {
  readonly model: 'nfe-distribuicao'
  readonly cnpj: string
  readonly uf: string
  readonly environment: FiscalEnvironment
  readonly certificadoBase64: string
  readonly certificadoSenha: string
}

/**
 * Item retornado pelo NF-e Distribuição DFe ou por importação de XML.
 * Cobre resumos (resNFe/resEvento), documentos completos (procNFe) e eventos (procEventoNFe).
 */
export type DfeItem = {
  /** NSU — Número Sequencial Único do DFe na SEFAZ Nacional. Vazio em importações por XML. */
  readonly nsu: string
  /** Schema do documento: 'resNFe', 'procNFe', 'resEvento', 'procEventoNFe', 'xml-import' */
  readonly schema: string
  /** XML comprimido em gzip+base64 — exatamente como a SEFAZ retorna. Vazio em importações. */
  readonly xmlComprimido: string
  /** XML descomprimido e decodificado (sempre presente em importações por XML) */
  readonly xmlDecoded?: string
  /** Chave de acesso de 44 dígitos */
  readonly chaveNfe?: string
  /** Modelo: '55' = NF-e, '65' = NFC-e */
  readonly mod?: string
  /** CNPJ do emitente */
  readonly emitenteCnpj?: string
  readonly emitenteNome?: string
  /** Valor total da NF-e */
  readonly valorTotal?: number
  readonly dataEmissao?: string
  /** cSitNFe: '1' = Uso autorizado, '2' = Cancelada, '3' = Denegada */
  readonly situacao?: string
  /** Código do tipo de evento — presente quando schema = resEvento ou procEventoNFe */
  readonly tipoEvento?: string
  /** Descrição do evento (ex: 'Cancelamento', 'Carta de Correção') */
  readonly descricaoEvento?: string
  /** Data/hora do evento */
  readonly dataEvento?: string
}

/**
 * Filtros opcionais aplicados client-side após o retorno do SEFAZ.
 * O SEFAZ não suporta filtragem server-side — todos os filtros são aplicados sobre o resultado.
 */
export type FiltrosDfe = {
  /** Filtra por modelo de documento: '55' = NF-e, '65' = NFC-e */
  readonly modelo?: '55' | '65'
  /** Filtra por CNPJ do emitente (somente dígitos) */
  readonly cnpjEmitente?: string
  /** Filtra por situação: '1' = Autorizada, '2' = Cancelada, '3' = Denegada */
  readonly situacao?: '1' | '2' | '3'
  /** Filtra documentos com dataEmissao >= dataInicio (ISO 8601 ou YYYY-MM-DD) */
  readonly dataInicio?: string
  /** Filtra documentos com dataEmissao <= dataFim (ISO 8601 ou YYYY-MM-DD) */
  readonly dataFim?: string
  /** Filtra documentos com valorTotal >= valorMinimo */
  readonly valorMinimo?: number
  /** Filtra documentos com valorTotal <= valorMaximo */
  readonly valorMaximo?: number
  /** Filtra por schema — ex: ['resNFe', 'procNFe'] para excluir eventos */
  readonly schemas?: readonly string[]
}

export type NfeDistribuicaoResult = {
  readonly itens: readonly DfeItem[]
  /** Último NSU recebido — persista este valor no banco para retomar na próxima chamada */
  readonly ultNSU: string
  /** NSU máximo disponível na SEFAZ no momento da consulta */
  readonly maxNSU: string
  /** true se há mais páginas — continue chamando com o ultNSU atualizado */
  readonly temMais: boolean
}

export type ConsultarDFeParams = {
  readonly config: NfeDistribuicaoConfig
  /**
   * NSU a partir do qual buscar.
   * Use '000000000000000' na primeira chamada.
   * Persista e reutilize o `ultNSU` retornado para sincronização incremental.
   */
  readonly ultNSU: string
  /** Filtros opcionais aplicados client-side sobre o resultado retornado pelo SEFAZ */
  readonly filtros?: FiltrosDfe
}

export type ConsultarPorNsuParams = {
  readonly config: NfeDistribuicaoConfig
  /** NSU exato a consultar — 15 dígitos (zero-padded automaticamente) */
  readonly nsu: string
}

export type ConsultarPorChaveParams = {
  readonly config: NfeDistribuicaoConfig
  /** Chave de acesso de 44 dígitos da NF-e */
  readonly chaveNfe: string
}

export type FiscalConfig =
  | NfceConfig
  | NfeConfig
  | SatConfig
  | NfseConfig
  | NotaRpConfig
  | CteConfig
  | NfeDistribuicaoConfig

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
  /** Dados obrigatórios para CT-e (modelo 57) */
  readonly cteData?: CteData
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

/** PDF do cupom fiscal (DANFCE / CF-e) em Base64 — pronto para download/impressão */
export type CupomPdfData = {
  readonly base64: string
  readonly mimeType: 'application/pdf'
  readonly fileName: string
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
  /** XML cru do <protNFe> devolvido pela SEFAZ — usado internamente para montar o nfeProc (xmlAutorizado). */
  readonly xmlProtocolo?: string
  readonly qrCodeUrl?: string
  readonly danfce?: DanfceData
  /** @deprecated Prefira `cupomPdf.base64` — mantido por compatibilidade */
  readonly danfePdfUrl?: string
  /** PDF 80mm com QR Code gerado após autorização */
  readonly cupomPdf?: CupomPdfData
  /** Código cStat da SEFAZ — ex: '100' autorizado, '225' falha schema, '209' IE inválida */
  readonly errorCode?: string
  readonly errorMessage?: string
  /** Orientação acionável em pt-BR para o cStat de rejeição, quando houver (ver SefazCstatHints). */
  readonly errorHint?: string
  readonly rawResponse: unknown
}

export type TestConnectionResult = {
  readonly ok: boolean
  readonly message: string
}
