import { XMLParser } from 'fast-xml-parser'
import { inflateSync } from 'zlib'
import { FiscalConnectionError, FiscalTimeoutError } from '../errors/FiscalError'
import type {
  NfeDistribuicaoConfig,
  NfeDistribuicaoResult,
  DfeItem,
  FiltrosDfe,
  ConsultarDFeParams,
  ConsultarPorNsuParams,
  ConsultarPorChaveParams,
} from '../types'
import { loadCertificate } from '../sefaz/SefazXmlSigner'
import { NFE_DISTRIBUICAO_ENDPOINT, UF_IBGE_CODES_CTE } from '../sefaz/CteConstants'

const REQUEST_TIMEOUT_MS = 30_000

const XML_PARSER = new XMLParser({
  ignoreAttributes: false,
  removeNSPrefix: true,
  attributeNamePrefix: '',
  parseTagValue: false,
})

// ─── CNPJ Info (BrasilAPI — sem autenticação) ─────────────────────────────────

export type CnpjInfo = {
  readonly cnpj: string
  readonly razaoSocial: string
  readonly nomeFantasia?: string
  readonly situacao: string
  readonly dataAbertura?: string
  readonly naturezaJuridica?: string
  readonly cnae?: string
  readonly cnaeDescricao?: string
  readonly logradouro?: string
  readonly numero?: string
  readonly complemento?: string
  readonly bairro?: string
  readonly municipio?: string
  readonly codigoMunicipio?: string
  readonly uf?: string
  readonly cep?: string
  readonly telefone?: string
  readonly email?: string
  readonly capitalSocial?: number
  readonly porte?: string
  readonly optanteSimplesNacional?: boolean
  readonly meEpp?: boolean
  readonly inscricaoEstadual?: string
}

const CNPJ_FETCH_HEADERS = {
  Accept: 'application/json',
  // BrasilAPI bloqueia fetch do Node sem User-Agent (HTTP 403)
  'User-Agent': 'Mozilla/5.0 (compatible; @adatechnology/fiscal-provider; +https://github.com/adatechnology)',
} as const

async function fetchCnpjFromBrasilApi(cnpjClean: string): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    return await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjClean}`, {
      signal: controller.signal,
      headers: CNPJ_FETCH_HEADERS,
    })
  } finally {
    clearTimeout(timer)
  }
}

async function fetchCnpjFromReceitaWs(cnpjClean: string): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    return await fetch(`https://receitaws.com.br/v1/cnpj/${cnpjClean}`, {
      signal: controller.signal,
      headers: CNPJ_FETCH_HEADERS,
    })
  } finally {
    clearTimeout(timer)
  }
}

function mapBrasilApiCnpj(cnpjClean: string, data: Record<string, unknown>): CnpjInfo {
  const company = data['company'] as Record<string, unknown> | undefined

  return {
    cnpj: cnpjClean,
    razaoSocial: String(data['razao_social'] ?? company?.['name'] ?? ''),
    nomeFantasia: data['nome_fantasia'] ? String(data['nome_fantasia']) : undefined,
    situacao: String(data['descricao_situacao_cadastral'] ?? data['status'] ?? ''),
    dataAbertura: data['data_inicio_atividade'] ? String(data['data_inicio_atividade']) : undefined,
    naturezaJuridica: data['natureza_juridica'] ? String(data['natureza_juridica']) : undefined,
    cnae: data['cnae_fiscal'] ? String(data['cnae_fiscal']) : undefined,
    cnaeDescricao: data['cnae_fiscal_descricao'] ? String(data['cnae_fiscal_descricao']) : undefined,
    logradouro: data['logradouro'] ? String(data['logradouro']) : undefined,
    numero: data['numero'] ? String(data['numero']) : undefined,
    complemento: data['complemento'] ? String(data['complemento']) : undefined,
    bairro: data['bairro'] ? String(data['bairro']) : undefined,
    municipio: data['municipio'] ? String(data['municipio']) : undefined,
    codigoMunicipio: data['codigo_municipio_ibge'] ? String(data['codigo_municipio_ibge']) : undefined,
    uf: data['uf'] ? String(data['uf']) : undefined,
    cep: data['cep'] ? String(data['cep']).replace(/\D/g, '') : undefined,
    telefone: data['ddd_telefone_1'] ? String(data['ddd_telefone_1']).replace(/\D/g, '') : undefined,
    email: data['email'] ? String(data['email']).toLowerCase() : undefined,
    capitalSocial: data['capital_social'] ? Number(data['capital_social']) : undefined,
    porte: data['descricao_porte'] ? String(data['descricao_porte']) : undefined,
    optanteSimplesNacional: data['opcao_pelo_simples'] === true,
    meEpp: data['descricao_porte'] === 'MICRO EMPRESA' || data['descricao_porte'] === 'EMPRESA DE PEQUENO PORTE',
  }
}

function mapReceitaWsCnpj(cnpjClean: string, data: Record<string, unknown>): CnpjInfo {
  const atividade = data['atividade_principal'] as Array<Record<string, unknown>> | undefined
  const cnaePrincipal = atividade?.[0]

  return {
    cnpj: cnpjClean,
    razaoSocial: String(data['nome'] ?? ''),
    nomeFantasia: data['fantasia'] ? String(data['fantasia']) : undefined,
    situacao: String(data['situacao'] ?? ''),
    dataAbertura: data['abertura'] ? String(data['abertura']) : undefined,
    naturezaJuridica: data['natureza_juridica'] ? String(data['natureza_juridica']) : undefined,
    cnae: cnaePrincipal?.['code'] ? String(cnaePrincipal['code']).replace(/\D/g, '') : undefined,
    cnaeDescricao: cnaePrincipal?.['text'] ? String(cnaePrincipal['text']) : undefined,
    logradouro: data['logradouro'] ? String(data['logradouro']) : undefined,
    numero: data['numero'] ? String(data['numero']) : undefined,
    complemento: data['complemento'] ? String(data['complemento']) : undefined,
    bairro: data['bairro'] ? String(data['bairro']) : undefined,
    municipio: data['municipio'] ? String(data['municipio']) : undefined,
    uf: data['uf'] ? String(data['uf']) : undefined,
    cep: data['cep'] ? String(data['cep']).replace(/\D/g, '') : undefined,
    telefone: data['telefone'] ? String(data['telefone']).replace(/\D/g, '') : undefined,
    email: data['email'] ? String(data['email']).toLowerCase() : undefined,
    capitalSocial: data['capital_social']
      ? Number(String(data['capital_social']).replace(/\./g, '').replace(',', '.'))
      : undefined,
    porte: data['porte'] ? String(data['porte']) : undefined,
  }
}

export async function consultarCnpj(cnpj: string): Promise<CnpjInfo> {
  const cnpjClean = cnpj.replace(/\D/g, '')
  if (cnpjClean.length !== 14) {
    throw new Error(`CNPJ inválido: "${cnpj}" — deve conter 14 dígitos`)
  }

  let response: Response
  try {
    response = await fetchCnpjFromBrasilApi(cnpjClean)
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Timeout na consulta de CNPJ — BrasilAPI não respondeu em 30s')
    }
    throw new Error(`Falha de rede ao consultar CNPJ: ${error instanceof Error ? error.message : 'desconhecido'}`)
  }

  if (response.status === 404) throw new Error(`CNPJ ${cnpjClean} não encontrado na Receita Federal`)
  if (response.status === 429) throw new Error('Rate limit excedido na BrasilAPI — aguarde alguns segundos')

  if (!response.ok) {
    // Fallback: ReceitaWS (quando BrasilAPI bloqueia/falha)
    try {
      const fallback = await fetchCnpjFromReceitaWs(cnpjClean)
      if (fallback.status === 404) throw new Error(`CNPJ ${cnpjClean} não encontrado na Receita Federal`)
      if (!fallback.ok) {
        throw new Error(`BrasilAPI retornou HTTP ${response.status} e fallback ReceitaWS HTTP ${fallback.status}`)
      }
      const fallbackData = (await fallback.json()) as Record<string, unknown>
      if (fallbackData['status'] === 'ERROR') {
        throw new Error(String(fallbackData['message'] ?? `CNPJ ${cnpjClean} não encontrado`))
      }
      return mapReceitaWsCnpj(cnpjClean, fallbackData)
    } catch (fallbackError) {
      if (fallbackError instanceof Error && fallbackError.message.includes('não encontrado')) {
        throw fallbackError
      }
      throw new Error(`BrasilAPI retornou HTTP ${response.status}`)
    }
  }

  const data = (await response.json()) as Record<string, unknown>
  return mapBrasilApiCnpj(cnpjClean, data)
}

// ─── XML Import ───────────────────────────────────────────────────────────────

/**
 * Importa uma NF-e a partir de um XML recebido externamente (e-mail, portal, etc).
 * Suporta os formatos: nfeProc (autorizada), NFe (sem protocolo), procEventoNFe (evento).
 * Retorna um DfeItem com schema='xml-import' e nsu=''.
 */
export function importarNfeXml(xml: string): DfeItem {
  const parsed = XML_PARSER.parse(xml)

  // nfeProc ou procNFe — XML completo com protocolo de autorização
  const nfeProc = parsed?.nfeProc ?? parsed?.procNFe
  if (nfeProc) {
    const infNFe = nfeProc?.NFe?.infNFe ?? nfeProc?.infNFe
    const chaveNfe = String(infNFe?.Id ?? '').replace(/^NFe/, '')
    return {
      nsu: '',
      schema: 'xml-import',
      xmlComprimido: '',
      xmlDecoded: xml,
      chaveNfe: chaveNfe || undefined,
      mod: String(infNFe?.ide?.mod ?? '55'),
      emitenteCnpj: String(infNFe?.emit?.CNPJ ?? infNFe?.emit?.CPF ?? '') || undefined,
      emitenteNome: String(infNFe?.emit?.xNome ?? '') || undefined,
      valorTotal: infNFe?.total?.ICMSTot?.vNF !== undefined ? Number(infNFe.total.ICMSTot.vNF) : undefined,
      dataEmissao: String(infNFe?.ide?.dhEmi ?? infNFe?.ide?.dEmi ?? '') || undefined,
      situacao: '1',
    }
  }

  // NFe sem protocolo (rascunho ou contingência)
  const bareNfe = parsed?.NFe
  if (bareNfe) {
    const infNFe = bareNfe?.infNFe
    const chaveNfe = String(infNFe?.Id ?? '').replace(/^NFe/, '')
    return {
      nsu: '',
      schema: 'xml-import',
      xmlComprimido: '',
      xmlDecoded: xml,
      chaveNfe: chaveNfe || undefined,
      mod: String(infNFe?.ide?.mod ?? '55'),
      emitenteCnpj: String(infNFe?.emit?.CNPJ ?? infNFe?.emit?.CPF ?? '') || undefined,
      emitenteNome: String(infNFe?.emit?.xNome ?? '') || undefined,
      valorTotal: infNFe?.total?.ICMSTot?.vNF !== undefined ? Number(infNFe.total.ICMSTot.vNF) : undefined,
      dataEmissao: String(infNFe?.ide?.dhEmi ?? infNFe?.ide?.dEmi ?? '') || undefined,
      situacao: undefined,
    }
  }

  // procEventoNFe — XML de evento (cancelamento, carta de correção, etc.)
  const procEvento = parsed?.procEventoNFe ?? parsed?.retEnvEvento
  if (procEvento) {
    const infEvento = procEvento?.evento?.infEvento ?? procEvento?.infEvento
    const retInfEvento = procEvento?.retEvento?.infEvento ?? procEvento?.retInfEvento
    const chaveNfe = String(infEvento?.chNFe ?? retInfEvento?.chNFe ?? '') || undefined
    const tipoEvento = String(infEvento?.tpEvento ?? retInfEvento?.tpEvento ?? '') || undefined
    return {
      nsu: '',
      schema: 'xml-import',
      xmlComprimido: '',
      xmlDecoded: xml,
      chaveNfe,
      mod: '55',
      emitenteCnpj: undefined,
      emitenteNome: undefined,
      valorTotal: undefined,
      dataEmissao: String(infEvento?.dhEvento ?? '') || undefined,
      situacao: undefined,
      tipoEvento,
      descricaoEvento: resolveDescricaoEvento(tipoEvento),
      dataEvento: String(infEvento?.dhEvento ?? retInfEvento?.dhEvento ?? '') || undefined,
    }
  }

  throw new Error('XML não reconhecido — esperado: nfeProc, NFe, ou procEventoNFe')
}

function resolveDescricaoEvento(tipoEvento: string | undefined): string | undefined {
  if (!tipoEvento) return undefined
  const descricoes: Record<string, string> = {
    '110111': 'Cancelamento',
    '110110': 'Carta de Correção',
    '110140': 'EPEC',
    '110120': 'Ficou sem Efeito',
    '110130': 'Autorização do Fisco',
    '210200': 'Ciência da Operação',
    '210210': 'Confirmação da Operação',
    '210220': 'Desconhecimento da Operação',
    '210240': 'Operação não Realizada',
  }
  return descricoes[tipoEvento]
}

// ─── NF-e Distribuição DFe ────────────────────────────────────────────────────

// chave: `${cnpj}:${environment}` → timestamp até quando o cooldown expira
const DIST_NSU_COOLDOWN_MS = 60 * 60 * 1_000 // 1 hora — regra SEFAZ após cStat 137
const distNsuCooldowns = new Map<string, number>()

export class NfeDistribuicaoProvider {
  /**
   * Paginação incremental — retorna até 50 DFes por chamada a partir do ultNSU informado.
   * Proteção automática contra cStat 656: se a consulta anterior retornou 137 (sem documentos),
   * novas chamadas são bloqueadas em memória por 1 hora sem bater no SEFAZ.
   *
   * ```typescript
   * let ultNSU = await db.getUltNSU(cnpj) ?? '000000000000000'
   * do {
   *   const page = await provider.consultarDFe({ config, ultNSU })
   *   await db.upsertNFes(page.itens)
   *   await db.setUltNSU(cnpj, page.ultNSU)
   *   ultNSU = page.ultNSU
   * } while (page.temMais)
   * ```
   */
  async consultarDFe(params: ConsultarDFeParams): Promise<NfeDistribuicaoResult> {
    const { config, ultNSU, filtros } = params
    const cnpjClean = config.cnpj.replace(/\D/g, '')
    const cooldownKey = `${cnpjClean}:${config.environment}`
    const cooldownUntil = distNsuCooldowns.get(cooldownKey)

    if (cooldownUntil !== undefined && Date.now() < cooldownUntil) {
      const restanteMs = cooldownUntil - Date.now()
      const restanteMin = Math.ceil(restanteMs / 60_000)
      throw new Error(
        `SEFAZ NFeDistribuicaoDFe: aguarde ${restanteMin} min antes de consultar o CNPJ ${cnpjClean} novamente (cooldown local pós-cStat 137)`,
      )
    }

    const certData = loadCertificate(config.certificadoBase64, config.certificadoSenha)
    const tpAmb = config.environment === 'producao' ? '1' : '2'
    const cUF = UF_IBGE_CODES_CTE[config.uf] ?? '35'

    const soapBody = buildDistNsuSoap({ cUF, cnpj: cnpjClean, ultNSU, tpAmb })
    const responseText = await this.fetchSefaz(config, certData, soapBody)
    const result = parseDistribuicaoResponse(responseText)

    // cStat 137 = sem documentos → ativa cooldown de 1h para evitar 656
    if (result.itens.length === 0 && !result.temMais) {
      distNsuCooldowns.set(cooldownKey, Date.now() + DIST_NSU_COOLDOWN_MS)
    } else {
      distNsuCooldowns.delete(cooldownKey)
    }

    return filtros ? { ...result, itens: aplicarFiltros(result.itens, filtros) } : result
  }

  /**
   * Consulta um NSU específico — retorna 0 ou 1 item.
   * Não sujeito ao rate limit de 1h do distNSU.
   */
  async consultarPorNsu(params: ConsultarPorNsuParams): Promise<DfeItem | undefined> {
    const { config, nsu } = params
    const certData = loadCertificate(config.certificadoBase64, config.certificadoSenha)
    const tpAmb = config.environment === 'producao' ? '1' : '2'
    const cUF = UF_IBGE_CODES_CTE[config.uf] ?? '35'
    const cnpjClean = config.cnpj.replace(/\D/g, '')

    const soapBody = buildConsNsuSoap({ cUF, cnpj: cnpjClean, nsu, tpAmb })
    const responseText = await this.fetchSefaz(config, certData, soapBody)
    const result = parseDistribuicaoResponse(responseText)
    return result.itens[0]
  }

  /**
   * Consulta pelo número de chave de acesso (44 dígitos).
   * Retorna a NF-e se o CNPJ configurado for destinatário, transportador ou emitente dela.
   */
  async consultarPorChave(params: ConsultarPorChaveParams): Promise<DfeItem | undefined> {
    const { config, chaveNfe } = params
    const chaveClean = chaveNfe.replace(/\D/g, '')
    if (chaveClean.length !== 44) {
      throw new Error(`Chave de acesso inválida: "${chaveNfe}" — deve conter 44 dígitos`)
    }

    const certData = loadCertificate(config.certificadoBase64, config.certificadoSenha)
    const tpAmb = config.environment === 'producao' ? '1' : '2'
    const cUF = UF_IBGE_CODES_CTE[config.uf] ?? '35'
    const cnpjClean = config.cnpj.replace(/\D/g, '')

    const soapBody = buildConsChaveSoap({ cUF, cnpj: cnpjClean, chaveNfe: chaveClean, tpAmb })
    const responseText = await this.fetchSefaz(config, certData, soapBody)
    const result = parseDistribuicaoResponse(responseText)
    return result.itens[0]
  }

  /**
   * Importa uma NF-e a partir de XML recebido externamente.
   * Delega para a função standalone `importarNfeXml`.
   */
  importarXml(xml: string): DfeItem {
    return importarNfeXml(xml)
  }

  async consultarCnpj(cnpj: string): Promise<CnpjInfo> {
    return consultarCnpj(cnpj)
  }

  private async fetchSefaz(
    config: NfeDistribuicaoConfig,
    certData: ReturnType<typeof loadCertificate>,
    soapBody: string,
  ): Promise<string> {
    const endpoint = NFE_DISTRIBUICAO_ENDPOINT[config.environment]

    let response: Response
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
      response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/soap+xml; charset=utf-8',
          SOAPAction: '"http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe/nfeDistDFeInteresse"',
        },
        body: soapBody,
        signal: controller.signal,
        // @ts-expect-error — Bun TLS extension para mTLS
        tls: {
          cert: certData.certificatePem,
          key: certData.privateKeyPem,
          rejectUnauthorized: false,
        },
      })
      clearTimeout(timer)
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new FiscalTimeoutError('SEFAZ NFeDistribuicaoDFe')
      }
      throw new FiscalConnectionError(
        'SEFAZ NFeDistribuicaoDFe',
        error instanceof Error ? error.message : 'desconhecido',
      )
    }

    return response.text()
  }
}

// ─── SOAP Builders ────────────────────────────────────────────────────────────

type SoapBaseParams = { cUF: string; cnpj: string; tpAmb: string }

function buildDistNsuSoap(params: SoapBaseParams & { ultNSU: string }): string {
  const nsu = params.ultNSU.padStart(15, '0')
  return buildSoapEnvelope(params, `<distNSU><ultNSU>${nsu}</ultNSU></distNSU>`)
}

function buildConsNsuSoap(params: SoapBaseParams & { nsu: string }): string {
  const nsu = params.nsu.padStart(15, '0')
  return buildSoapEnvelope(params, `<consNSU><NSU>${nsu}</NSU></consNSU>`)
}

function buildConsChaveSoap(params: SoapBaseParams & { chaveNfe: string }): string {
  return buildSoapEnvelope(params, `<consChNFe><chNFe>${params.chaveNfe}</chNFe></consChNFe>`)
}

function buildSoapEnvelope(params: SoapBaseParams, queryBody: string): string {
  const ns = 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe'
  const nfens = 'http://www.portalfiscal.inf.br/nfe'
  return `<?xml version="1.0" encoding="UTF-8"?><soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope"><soap12:Body><nfeDistDFeInteresse xmlns="${ns}"><nfeDadosMsg><distDFeInt versao="1.01" xmlns="${nfens}"><tpAmb>${params.tpAmb}</tpAmb><cUFAutor>${params.cUF}</cUFAutor><CNPJ>${params.cnpj}</CNPJ>${queryBody}</distDFeInt></nfeDadosMsg></nfeDistDFeInteresse></soap12:Body></soap12:Envelope>`
}

// ─── Filtros ──────────────────────────────────────────────────────────────────

function aplicarFiltros(itens: readonly DfeItem[], filtros: FiltrosDfe): readonly DfeItem[] {
  return itens.filter((item) => {
    if (filtros.modelo && item.mod !== filtros.modelo) return false
    if (filtros.cnpjEmitente && item.emitenteCnpj?.replace(/\D/g, '') !== filtros.cnpjEmitente.replace(/\D/g, ''))
      return false
    if (filtros.situacao && item.situacao !== filtros.situacao) return false
    if (filtros.schemas && !filtros.schemas.includes(item.schema)) return false
    if (filtros.valorMinimo !== undefined && (item.valorTotal === undefined || item.valorTotal < filtros.valorMinimo))
      return false
    if (filtros.valorMaximo !== undefined && (item.valorTotal === undefined || item.valorTotal > filtros.valorMaximo))
      return false
    if (filtros.dataInicio && item.dataEmissao && item.dataEmissao < filtros.dataInicio) return false
    if (filtros.dataFim && item.dataEmissao && item.dataEmissao > filtros.dataFim) return false
    return true
  })
}

// ─── Parser ───────────────────────────────────────────────────────────────────

function parseDistribuicaoResponse(soapXml: string): NfeDistribuicaoResult {
  const parsed = XML_PARSER.parse(soapXml)
  const body = parsed?.Envelope?.Body
  const retDist =
    body?.nfeDistDFeInteresseResponse?.nfeDistDFeInteresseResult?.retDistDFeInt ??
    body?.nfeDistDFeInteresseResult?.retDistDFeInt ??
    body?.retDistDFeInt

  const cStat = String(retDist?.cStat ?? '')
  if (cStat === '656') {
    throw new Error(
      'SEFAZ NFeDistribuicaoDFe: rate limit atingido — aguarde 1 hora antes de consultar novamente o mesmo CNPJ (cStat 656)',
    )
  }
  if (cStat !== '137' && cStat !== '138') {
    throw new Error(`SEFAZ NFeDistribuicaoDFe cStat ${cStat}: ${String(retDist?.xMotivo ?? 'erro desconhecido')}`)
  }

  const ultNSU = String(retDist?.ultNSU ?? '000000000000000')
  const maxNSU = String(retDist?.maxNSU ?? ultNSU)

  const rawDocs = retDist?.loteDistDFeInt?.docZip
  const docs: unknown[] = !rawDocs ? [] : Array.isArray(rawDocs) ? rawDocs : [rawDocs]

  const itens: DfeItem[] = docs.map((doc) => parseDocZip(doc as Record<string, unknown>))

  const temMais = cStat === '138' || (maxNSU !== ultNSU && docs.length >= 50)

  return { itens, ultNSU, maxNSU, temMais }
}

function parseDocZip(doc: Record<string, unknown>): DfeItem {
  const nsu = String(doc['NSU'] ?? doc['nsu'] ?? '')
  const schema = String(doc['schema'] ?? '')
  const xmlComprimido = String(doc['#text'] ?? doc['_'] ?? '')

  let xmlDecoded: string | undefined
  let chaveNfe: string | undefined
  let emitenteCnpj: string | undefined
  let emitenteNome: string | undefined
  let valorTotal: number | undefined
  let dataEmissao: string | undefined
  let situacao: string | undefined
  let mod: string | undefined
  let tipoEvento: string | undefined
  let descricaoEvento: string | undefined
  let dataEvento: string | undefined

  try {
    const buffer = Buffer.from(xmlComprimido, 'base64')
    xmlDecoded = inflateSync(buffer).toString('utf-8')
    const docParsed = XML_PARSER.parse(xmlDecoded)

    // resNFe — resumo da NF-e (distribuição para transportador/destinatário)
    const resNFe = docParsed?.resNFe
    if (resNFe) {
      chaveNfe = String(resNFe.chNFe ?? '')
      emitenteCnpj = String(resNFe.CNPJ ?? resNFe.CPF ?? '')
      emitenteNome = String(resNFe.xNome ?? '')
      valorTotal = resNFe.vNF !== undefined ? Number(resNFe.vNF) : undefined
      dataEmissao = String(resNFe.dhEmi ?? '')
      situacao = String(resNFe.cSitNFe ?? '')
      mod = String(resNFe.mod ?? '55')
    }

    // procNFe / nfeProc — XML completo autorizado
    const procNFe = docParsed?.nfeProc ?? docParsed?.procNFe
    if (procNFe) {
      const infNFe = procNFe?.NFe?.infNFe ?? procNFe?.infNFe
      chaveNfe = String(infNFe?.Id ?? '').replace(/^NFe/, '')
      emitenteCnpj = String(infNFe?.emit?.CNPJ ?? infNFe?.emit?.CPF ?? '')
      emitenteNome = String(infNFe?.emit?.xNome ?? '')
      valorTotal = infNFe?.total?.ICMSTot?.vNF !== undefined ? Number(infNFe.total.ICMSTot.vNF) : undefined
      dataEmissao = String(infNFe?.ide?.dhEmi ?? '')
      mod = String(infNFe?.ide?.mod ?? '55')
      situacao = '1'
    }

    // resEvento — resumo de evento (cancelamento, CCe, etc.)
    const resEvento = docParsed?.resEvento
    if (resEvento) {
      chaveNfe = String(resEvento.chNFe ?? '') || undefined
      tipoEvento = String(resEvento.tpEvento ?? '') || undefined
      descricaoEvento = String(resEvento.xEvento ?? '') || resolveDescricaoEvento(tipoEvento)
      dataEvento = String(resEvento.dhEvento ?? '') || undefined
      dataEmissao = dataEvento
      situacao = String(resEvento.cSitNFe ?? '') || undefined
      mod = String(resEvento.mod ?? '55')
    }

    // procEventoNFe — evento completo
    const procEvento = docParsed?.procEventoNFe
    if (procEvento) {
      const infEvento = procEvento?.evento?.infEvento
      const retInfEvento = procEvento?.retEvento?.infEvento
      chaveNfe = String(infEvento?.chNFe ?? retInfEvento?.chNFe ?? '') || undefined
      tipoEvento = String(infEvento?.tpEvento ?? '') || undefined
      descricaoEvento = resolveDescricaoEvento(tipoEvento)
      dataEvento = String(infEvento?.dhEvento ?? retInfEvento?.dhRegEvento ?? '') || undefined
      dataEmissao = dataEvento
      mod = '55'
    }
  } catch {
    // gzip decode failure — retorna item com campos mínimos
  }

  return {
    nsu,
    schema,
    xmlComprimido,
    xmlDecoded,
    chaveNfe,
    mod,
    emitenteCnpj,
    emitenteNome,
    valorTotal,
    dataEmissao,
    situacao,
    tipoEvento,
    descricaoEvento,
    dataEvento,
  }
}
