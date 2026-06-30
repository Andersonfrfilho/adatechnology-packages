import { XMLParser } from 'fast-xml-parser'
import { inflateSync } from 'zlib'
import { FiscalConnectionError, FiscalTimeoutError } from '../errors/FiscalError'
import type {
  NfeDistribuicaoConfig,
  NfeDistribuicaoResult,
  DfeItem,
  ConsultarDFeParams,
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
  readonly uf?: string
  readonly cep?: string
  readonly telefone?: string
  readonly email?: string
  readonly capitalSocial?: number
  readonly porte?: string
  readonly optanteSimplesNacional?: boolean
  readonly meEpp?: boolean
}

/**
 * Consulta dados cadastrais de um CNPJ via BrasilAPI.
 * Sem autenticação — limite de taxa aplicado pela API pública.
 * Ideal para exibir informações do emissor/destinatário de NF-e/CT-e.
 */
export async function consultarCnpj(cnpj: string): Promise<CnpjInfo> {
  const cnpjClean = cnpj.replace(/\D/g, '')
  if (cnpjClean.length !== 14) {
    throw new Error(`CNPJ inválido: "${cnpj}" — deve conter 14 dígitos`)
  }

  let response: Response
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
    response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjClean}`, {
      signal: controller.signal,
    })
    clearTimeout(timer)
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Timeout na consulta de CNPJ — BrasilAPI não respondeu em 30s')
    }
    throw new Error(`Falha de rede ao consultar CNPJ: ${error instanceof Error ? error.message : 'desconhecido'}`)
  }

  if (response.status === 404) {
    throw new Error(`CNPJ ${cnpjClean} não encontrado na Receita Federal`)
  }

  if (response.status === 429) {
    throw new Error('Rate limit excedido na BrasilAPI — aguarde alguns segundos')
  }

  if (!response.ok) {
    throw new Error(`BrasilAPI retornou HTTP ${response.status}`)
  }

  const data = await response.json() as Record<string, unknown>
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

// ─── NF-e Distribuição DFe ────────────────────────────────────────────────────

/**
 * Consulta NF-es, NFC-es e eventos vinculados ao CNPJ do interessado (destinatário,
 * transportador, emitente) na SEFAZ Nacional.
 *
 * **Paginação incremental para sincronização com banco:**
 * ```typescript
 * // 1ª chamada — pega tudo desde o início
 * let ultNSU = await db.getUltNSU(cnpj) ?? '000000000000000'
 *
 * do {
 *   const page = await provider.consultarDFe({ config, ultNSU })
 *   await db.upsertNFes(page.itens)           // salva/atualiza no banco
 *   await db.setUltNSU(cnpj, page.ultNSU)    // persiste paginação
 *   ultNSU = page.ultNSU
 * } while (page.temMais)
 *
 * // Próxima execução (cron/webhook) retoma do ultNSU salvo
 * ```
 */
export class NfeDistribuicaoProvider {
  async consultarDFe(params: ConsultarDFeParams): Promise<NfeDistribuicaoResult> {
    const { config, ultNSU } = params
    const certData = loadCertificate(config.certificadoBase64, config.certificadoSenha)

    const endpoint = NFE_DISTRIBUICAO_ENDPOINT[config.environment]
    const cUF = UF_IBGE_CODES_CTE[config.uf] ?? '35'
    const tpAmb = config.environment === 'producao' ? '1' : '2'
    const cnpjClean = config.cnpj.replace(/\D/g, '')

    const soapBody = buildDistribuicaoSoap({ cUF, cnpj: cnpjClean, ultNSU, tpAmb })

    let response: Response
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
      response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/soap+xml; charset=utf-8',
          'SOAPAction': '"http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe/nfeDistDFeInteresse"',
        },
        body: soapBody,
        signal: controller.signal,
        // @ts-ignore — Bun TLS extension para mTLS
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
      throw new FiscalConnectionError('SEFAZ NFeDistribuicaoDFe', error instanceof Error ? error.message : 'desconhecido')
    }

    const responseText = await response.text()
    return parseDistribuicaoResponse(responseText)
  }

  /** Alias direto para consultarCnpj — disponível na instância para uso uniforme */
  async consultarCnpj(cnpj: string): Promise<CnpjInfo> {
    return consultarCnpj(cnpj)
  }
}

// ─── Builders ─────────────────────────────────────────────────────────────────

function buildDistribuicaoSoap(params: {
  cUF: string
  cnpj: string
  ultNSU: string
  tpAmb: string
}): string {
  const nsu = params.ultNSU.padStart(15, '0')
  const ns = 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe'
  const nfens = 'http://www.portalfiscal.inf.br/nfe'
  return `<?xml version="1.0" encoding="UTF-8"?><soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope"><soap12:Body><nfeDistDFeInteresse xmlns="${ns}"><nfeDadosMsg><distDFeInt versao="1.01" xmlns="${nfens}"><tpAmb>${params.tpAmb}</tpAmb><cUFAutor>${params.cUF}</cUFAutor><CNPJ>${params.cnpj}</CNPJ><distNSU><ultNSU>${nsu}</ultNSU></distNSU></distDFeInt></nfeDadosMsg></nfeDistDFeInteresse></soap12:Body></soap12:Envelope>`
}

// ─── Parser ───────────────────────────────────────────────────────────────────

function parseDistribuicaoResponse(soapXml: string): NfeDistribuicaoResult {
  const parsed = XML_PARSER.parse(soapXml)
  const body = parsed?.Envelope?.Body
  const retDist = body?.nfeDistDFeInteresseResponse?.nfeDistDFeInteresseResult?.retDistDFeInt
              ?? body?.nfeDistDFeInteresseResult?.retDistDFeInt
              ?? body?.retDistDFeInt

  const cStat = String(retDist?.cStat ?? '')
  if (cStat !== '137' && cStat !== '138') {
    throw new Error(`SEFAZ NFeDistribuicaoDFe cStat ${cStat}: ${String(retDist?.xMotivo ?? 'erro desconhecido')}`)
  }

  const ultNSU = String(retDist?.ultNSU ?? '000000000000000')
  const maxNSU = String(retDist?.maxNSU ?? ultNSU)

  const rawDocs = retDist?.loteDistDFeInt?.docZip
  const docs: unknown[] = !rawDocs
    ? []
    : Array.isArray(rawDocs) ? rawDocs : [rawDocs]

  const itens: DfeItem[] = docs.map((doc) => {
    const d = doc as Record<string, unknown>
    const nsu = String(d['NSU'] ?? d['nsu'] ?? '')
    const schema = String(d['schema'] ?? '')
    const xmlComprimido = String(d['#text'] ?? d['_'] ?? '')

    let xmlDecoded: string | undefined
    let chaveNfe: string | undefined
    let emitenteCnpj: string | undefined
    let emitenteNome: string | undefined
    let valorTotal: number | undefined
    let dataEmissao: string | undefined
    let situacao: string | undefined
    let mod: string | undefined

    try {
      const buffer = Buffer.from(xmlComprimido, 'base64')
      xmlDecoded = inflateSync(buffer).toString('utf-8')

      const docParsed = XML_PARSER.parse(xmlDecoded)

      // resNFe — resumo (campo mais comum para distribuição de transportador)
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

      // procNFe — XML completo autorizado
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
    } catch {
      // gzip decode failure — leave decoded undefined
    }

    return { nsu, schema, xmlComprimido, xmlDecoded, chaveNfe, mod, emitenteCnpj, emitenteNome, valorTotal, dataEmissao, situacao }
  })

  const temMais = cStat === '138' || (maxNSU !== ultNSU && docs.length >= 50)

  return { itens, ultNSU, maxNSU, temMais }
}
