import { XMLParser } from 'fast-xml-parser'
import { FiscalError } from '../errors/FiscalError'
import type { FiscalResult } from '../types'
import { SEFAZ_RETRYABLE_CODES } from './SefazConstants'
import { signNfeEventoXml, signInutNFeXml } from './SefazXmlSigner'
import type { CertificateData } from './SefazXmlSigner'
import { sefazFetch } from './SefazHttpClient'

const REQUEST_TIMEOUT_MS = 30_000

type SoapSendParams = {
  readonly endpoint: string
  readonly cUF: string
  readonly signedNfeXml: string
  readonly loteId: string
  readonly wsdlNamespace: string
  readonly certData: CertificateData
}

const XML_PARSER = new XMLParser({
  ignoreAttributes: false,
  removeNSPrefix: true,
  attributeNamePrefix: '',
  parseTagValue: false, // mantém valores como string — evita chave 44 dígitos virar notação científica
})

export async function sendNfceAutorizacao(params: SoapSendParams): Promise<FiscalResult> {
  const soapBody = buildSoapEnvelope(params)
  // SP usa WSDL NFeAutorizacao4 (método nfeAutorizacaoLote); demais UFs usam NfceAutorizacao4
  const method = params.wsdlNamespace.includes('NFeAutorizacao4') ? 'nfeAutorizacaoLote' : 'nfceAutorizacaoNF'
  const soapAction = `"${params.wsdlNamespace}/${method}"`

  const response = await fetchWithTimeout(
    params.endpoint,
    {
      method: 'POST',
      headers: {
        'Content-Type': `application/soap+xml; charset=utf-8; action=${soapAction}`,
        SOAPAction: soapAction,
      },
      body: soapBody,
    },
    params.certData,
  )

  const responseText = await response.text()

  if (!response.ok) {
    return {
      success: false,
      errorCode: `HTTP_${response.status}`,
      errorMessage: `SEFAZ retornou HTTP ${response.status}`,
      rawResponse: responseText,
    }
  }

  return parseSefazResponse(responseText)
}

export async function sendNfceCancelamento(params: {
  endpoint: string
  cUF: string
  chaveAcesso: string
  protocolo: string
  justificativa: string
  cnpj: string
  dhEvento: string
  nSeqEvento: string
  tpAmb: string
  certData: CertificateData
}): Promise<FiscalResult> {
  const unsignedXml = buildCancelamentoEventoXml(params)
  const { signedXml } = signNfeEventoXml(unsignedXml, params.certData)
  const eventoXml = signedXml.replace(/^<\?xml[^?]*\?>\s*/i, '')
  const soapBody = buildEventoSoapEnvelope({ cUF: params.cUF, eventoXml })

  const response = await fetchWithTimeout(
    params.endpoint,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/soap+xml; charset=utf-8',
        SOAPAction: '"http://www.portalfiscal.inf.br/nfe/wsdl/NfceRecepcaoEvento4/nfceRecepcaoEvento"',
      },
      body: soapBody,
    },
    params.certData,
  )

  const responseText = await response.text()
  return parseSefazEventoResponse(responseText)
}

export async function sendStatusServico(params: {
  endpoint: string
  cUF: string
  certData: CertificateData
  /** '1'=produção, '2'=homologação — deve casar com o ambiente do endpoint (cStat 252 caso divirja) */
  tpAmb?: string
  /** Namespace WSDL — SP usa NFeStatusServico4; demais NfceStatusServico4 */
  wsdlNamespace?: string
}): Promise<{ ok: boolean; message: string; dhRecbto?: string }> {
  const ns =
    params.wsdlNamespace ??
    (params.endpoint.includes('nfce.fazenda.sp.gov.br')
      ? 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeStatusServico4'
      : 'http://www.portalfiscal.inf.br/nfe/wsdl/NfceStatusServico4')
  const soapBody = buildStatusServicoSoap(params.cUF, ns, params.tpAmb ?? '2')
  const method = ns.includes('NFeStatusServico4') ? 'nfeStatusServicoNF' : 'nfceStatusServico'
  const soapAction = `"${ns}/${method}"`

  try {
    const response = await fetchWithTimeout(
      params.endpoint,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/soap+xml; charset=utf-8',
          SOAPAction: soapAction,
        },
        body: soapBody,
      },
      params.certData,
    )
    const responseText = await response.text()
    return parseStatusResponse(responseText)
  } catch {
    return { ok: false, message: 'SEFAZ não respondeu ao status' }
  }
}

// ─── Builders ────────────────────────────────────────────────────────────────

function buildNfeSoapEnvelope({ cUF, signedNfeXml, loteId, wsdlNamespace }: SoapSendParams): string {
  // Strip XML declaration: cannot nest <?xml?> inside SOAP body (causes HTTP 400)
  const nfeFragment = signedNfeXml.replace(/^<\?xml[^?]*\?>\s*/i, '')
  // Compact: SP SEFAZ rejects whitespace between tags (cStat 588)
  return `<?xml version="1.0" encoding="UTF-8"?><soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope"><soap12:Header><nfeCabecMsg xmlns="${wsdlNamespace}"><cUF>${cUF}</cUF><versaoDados>4.00</versaoDados></nfeCabecMsg></soap12:Header><soap12:Body><nfeDadosMsg xmlns="${wsdlNamespace}"><enviNFe versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe"><idLote>${loteId.padStart(15, '0')}</idLote><indSinc>1</indSinc>${nfeFragment}</enviNFe></nfeDadosMsg></soap12:Body></soap12:Envelope>`
}

function buildNfeEventoSoapEnvelope({ cUF, eventoXml }: { cUF: string; eventoXml: string }): string {
  // Compact: SP SEFAZ rejects whitespace between tags (cStat 588)
  return `<?xml version="1.0" encoding="UTF-8"?><soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope"><soap12:Header><nfeCabecMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeRecepcaoEvento4"><cUF>${cUF}</cUF><versaoDados>1.00</versaoDados></nfeCabecMsg></soap12:Header><soap12:Body><nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeRecepcaoEvento4">${eventoXml}</nfeDadosMsg></soap12:Body></soap12:Envelope>`
}

function buildNfeStatusServicoSoap(cUF: string): string {
  // Namespace NFeStatusServico4 (NF maiúsculo) — confirmado via WSDL real SEFAZ SP
  const ns = 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeStatusServico4'
  return `<?xml version="1.0" encoding="UTF-8"?><soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope"><soap12:Header><nfeCabecMsg xmlns="${ns}"><cUF>${cUF}</cUF><versaoDados>4.00</versaoDados></nfeCabecMsg></soap12:Header><soap12:Body><nfeDadosMsg xmlns="${ns}"><consStatServ versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe"><tpAmb>2</tpAmb><cUF>${cUF}</cUF><xServ>STATUS</xServ></consStatServ></nfeDadosMsg></soap12:Body></soap12:Envelope>`
}

function buildSoapEnvelope({ cUF, signedNfeXml, loteId, wsdlNamespace }: SoapSendParams): string {
  // Strip XML declaration: cannot nest <?xml?> inside SOAP body (causes HTTP 400)
  const nfceFragment = signedNfeXml.replace(/^<\?xml[^?]*\?>\s*/i, '')
  return `<?xml version="1.0" encoding="UTF-8"?><soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope"><soap12:Header><nfeCabecMsg xmlns="${wsdlNamespace}"><cUF>${cUF}</cUF><versaoDados>4.00</versaoDados></nfeCabecMsg></soap12:Header><soap12:Body><nfeDadosMsg xmlns="${wsdlNamespace}"><enviNFe versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe"><idLote>${loteId.padStart(15, '0')}</idLote><indSinc>1</indSinc>${nfceFragment}</enviNFe></nfeDadosMsg></soap12:Body></soap12:Envelope>`
}

function buildEventoSoapEnvelope({ cUF, eventoXml }: { cUF: string; eventoXml: string }): string {
  // Compact: SP SEFAZ rejects whitespace between tags (cStat 588)
  return `<?xml version="1.0" encoding="UTF-8"?><soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope"><soap12:Header><nfeCabecMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeRecepcaoEvento4"><cUF>${cUF}</cUF><versaoDados>1.00</versaoDados></nfeCabecMsg></soap12:Header><soap12:Body><nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeRecepcaoEvento4">${eventoXml}</nfeDadosMsg></soap12:Body></soap12:Envelope>`
}

function buildCancelamentoEventoXml(params: {
  chaveAcesso: string
  protocolo: string
  justificativa: string
  cnpj: string
  dhEvento: string
  nSeqEvento: string
  cUF: string
  tpAmb: string
}): string {
  const id = `ID110111${params.chaveAcesso}${params.nSeqEvento.padStart(2, '0')}`
  // Compact: SP SEFAZ rejects whitespace between tags (cStat 588)
  return `<envEvento versao="1.00" xmlns="http://www.portalfiscal.inf.br/nfe"><idLote>1</idLote><evento versao="1.00"><infEvento Id="${id}"><cOrgao>${params.cUF}</cOrgao><tpAmb>${params.tpAmb}</tpAmb><CNPJ>${params.cnpj.replace(/\D/g, '')}</CNPJ><chNFe>${params.chaveAcesso}</chNFe><dhEvento>${params.dhEvento}</dhEvento><tpEvento>110111</tpEvento><nSeqEvento>${params.nSeqEvento}</nSeqEvento><verEvento>1.00</verEvento><detEvento versao="1.00"><descEvento>Cancelamento</descEvento><nProt>${params.protocolo}</nProt><xJust>${params.justificativa}</xJust></detEvento></infEvento></evento></envEvento>`
}

function buildStatusServicoSoap(
  cUF: string,
  wsdlNamespace = 'http://www.portalfiscal.inf.br/nfe/wsdl/NfceStatusServico4',
  tpAmb = '2',
): string {
  // Compact: SP SEFAZ rejects whitespace between tags (cStat 588)
  return `<?xml version="1.0" encoding="UTF-8"?><soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope"><soap12:Header><nfeCabecMsg xmlns="${wsdlNamespace}"><cUF>${cUF}</cUF><versaoDados>4.00</versaoDados></nfeCabecMsg></soap12:Header><soap12:Body><nfeDadosMsg xmlns="${wsdlNamespace}"><consStatServ versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe"><tpAmb>${tpAmb}</tpAmb><cUF>${cUF}</cUF><xServ>STATUS</xServ></consStatServ></nfeDadosMsg></soap12:Body></soap12:Envelope>`
}

// ─── Parsers ──────────────────────────────────────────────────────────────────

function parseSefazResponse(soapXml: string): FiscalResult {
  try {
    const parsed = XML_PARSER.parse(soapXml)
    const body = parsed?.Envelope?.Body
    const resultMsg = body?.nfceResultMsg ?? body?.nfeResultMsg
    const retEnvi = resultMsg?.retEnviNFe ?? resultMsg?.retNFe

    const cStat = String(retEnvi?.cStat ?? retEnvi?.infRec?.cStat ?? '')
    const xMotivo = String(retEnvi?.xMotivo ?? '')

    if (cStat === '104') {
      const prot = retEnvi?.protNFe?.infProt
      const cStatNfe = String(prot?.cStat ?? '')
      const xMotivoNfe = String(prot?.xMotivo ?? '')

      if (cStatNfe === '100' || cStatNfe === '150') {
        return {
          success: true,
          chaveAcesso: String(prot?.chNFe ?? ''),
          protocolo: String(prot?.nProt ?? ''),
          xmlProtocolo: soapXml.match(/<protNFe[\s\S]*?<\/protNFe>/)?.[0],
          rawResponse: retEnvi,
        }
      }

      return {
        success: false,
        errorCode: cStatNfe,
        errorMessage: xMotivoNfe || `SEFAZ rejeitou: ${cStatNfe}`,
        rawResponse: retEnvi,
      }
    }

    if (SEFAZ_RETRYABLE_CODES.has(cStat)) {
      throw new FiscalError(
        `SEFAZ indisponível temporariamente [${cStat}]: ${xMotivo}`,
        cStat,
        xMotivo,
        retEnvi ?? soapXml,
      )
    }

    return {
      success: false,
      errorCode: cStat || 'SEFAZ_UNKNOWN',
      errorMessage: xMotivo || `SEFAZ retornou cStat ${cStat} sem descrição`,
      rawResponse: retEnvi ?? soapXml,
    }
  } catch (error) {
    if (error instanceof FiscalError) throw error
    return {
      success: false,
      errorCode: 'PARSE_ERROR',
      errorMessage: `Não foi possível interpretar a resposta da SEFAZ: ${error instanceof Error ? error.message : 'erro desconhecido'}`,
      rawResponse: soapXml,
    }
  }
}

function parseSefazEventoResponse(soapXml: string): FiscalResult {
  try {
    const parsed = XML_PARSER.parse(soapXml)
    const body = parsed?.Envelope?.Body
    const resultMsg = body?.nfceResultMsg ?? body?.nfeResultMsg
    const retEvento = resultMsg?.retEnvEvento
    const infEvento = retEvento?.retEvento?.infEvento

    const cStat = String(infEvento?.cStat ?? retEvento?.cStat ?? '')
    const xMotivo = String(infEvento?.xMotivo ?? retEvento?.xMotivo ?? '')

    if (cStat === '135') {
      return { success: true, protocolo: String(infEvento?.nProt ?? ''), rawResponse: retEvento }
    }

    if (!cStat) {
      return {
        success: false,
        errorCode: 'EVENTO_PARSE_ERROR',
        errorMessage: 'Resposta da SEFAZ não contém cStat — XML inesperado ou serviço fora do ar',
        rawResponse: soapXml,
      }
    }

    return {
      success: false,
      errorCode: cStat,
      errorMessage: xMotivo || `Cancelamento rejeitado pelo SEFAZ: cStat ${cStat}`,
      rawResponse: retEvento ?? soapXml,
    }
  } catch (error) {
    return {
      success: false,
      errorCode: 'EVENTO_PARSE_ERROR',
      errorMessage: `Falha ao interpretar resposta do cancelamento: ${error instanceof Error ? error.message : 'erro desconhecido'}`,
      rawResponse: soapXml,
    }
  }
}

function parseStatusResponse(soapXml: string): { ok: boolean; message: string; dhRecbto?: string } {
  try {
    if (soapXml.trimStart().startsWith('<') && soapXml.includes('<html')) {
      const isNotFound = soapXml.includes('resource cannot be found') || soapXml.includes('404')
      const isForbidden =
        soapXml.includes('403') || soapXml.includes('Forbidden') || soapXml.includes('Access is denied')
      if (isNotFound) {
        return {
          ok: false,
          message:
            'SEFAZ retornou HTML 404 — certificado rejeitado na camada de aplicação (OU=VideoConferencia não autorizado para NFC-e/NF-e). Necessário e-CNPJ A1 de uso fiscal.',
        }
      }
      if (isForbidden) {
        return {
          ok: false,
          message: 'SEFAZ retornou HTML 403 — certificado não apresentado ou TLS rejeitado.',
        }
      }
      return {
        ok: false,
        message: `SEFAZ retornou HTML inesperado (não SOAP). Primeiros 200 chars: ${soapXml.slice(0, 200)}`,
      }
    }

    const parsed = XML_PARSER.parse(soapXml)
    const body = parsed?.Envelope?.Body
    const retStatus = body?.nfceResultMsg?.retConsStatServ ?? body?.nfeResultMsg?.retConsStatServ
    const cStat = String(retStatus?.cStat ?? '')
    const xMotivo = String(retStatus?.xMotivo ?? '')
    // dhRecbto = hora do servidor SEFAZ; vem mesmo em respostas não-107 (ex.: 252) — usada
    // pelo cancelamento como base de tempo imune a drift do relógio local.
    const dhRecbto = retStatus?.dhRecbto ? String(retStatus.dhRecbto) : undefined

    if (!cStat) {
      return {
        ok: false,
        message: `Resposta de status inesperada — cStat ausente. Primeiros 300 chars: ${soapXml.slice(0, 300)}`,
      }
    }

    if (cStat !== '107') {
      return { ok: false, message: `SEFAZ fora do ar [${cStat}]: ${xMotivo || 'sem descrição'}`, dhRecbto }
    }

    return { ok: true, message: xMotivo || 'Serviço em operação', dhRecbto }
  } catch (error) {
    return {
      ok: false,
      message: `Falha ao interpretar resposta de status: ${error instanceof Error ? error.message : 'erro desconhecido'}`,
    }
  }
}

export async function sendNfeAutorizacao(params: SoapSendParams): Promise<FiscalResult> {
  const soapBody = buildNfeSoapEnvelope(params)
  const soapAction = `"${params.wsdlNamespace}/nfeAutorizacaoLote"`

  const response = await fetchWithTimeout(
    params.endpoint,
    {
      method: 'POST',
      headers: {
        'Content-Type': `application/soap+xml; charset=utf-8; action=${soapAction}`,
        SOAPAction: soapAction,
      },
      body: soapBody,
    },
    params.certData,
  )

  const responseText = await response.text()

  if (!response.ok) {
    return {
      success: false,
      errorCode: `HTTP_${response.status}`,
      errorMessage: `SEFAZ retornou HTTP ${response.status}`,
      rawResponse: responseText,
    }
  }

  return parseSefazResponse(responseText)
}

export async function sendNfeCancelamento(params: {
  endpoint: string
  cUF: string
  chaveAcesso: string
  protocolo: string
  justificativa: string
  cnpj: string
  dhEvento: string
  nSeqEvento: string
  tpAmb: string
  certData: CertificateData
}): Promise<FiscalResult> {
  const unsignedXml = buildCancelamentoEventoXml(params)
  const { signedXml } = signNfeEventoXml(unsignedXml, params.certData)
  const eventoXml = signedXml.replace(/^<\?xml[^?]*\?>\s*/i, '')
  const soapBody = buildNfeEventoSoapEnvelope({ cUF: params.cUF, eventoXml })

  const response = await fetchWithTimeout(
    params.endpoint,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/soap+xml; charset=utf-8',
        SOAPAction: '"http://www.portalfiscal.inf.br/nfe/wsdl/NFeRecepcaoEvento4/nfeRecepcaoEvento"',
      },
      body: soapBody,
    },
    params.certData,
  )

  const responseText = await response.text()
  return parseSefazEventoResponse(responseText)
}

export async function sendNfeStatusServico(params: {
  endpoint: string
  cUF: string
  certData: CertificateData
}): Promise<{ ok: boolean; message: string; dhRecbto?: string }> {
  // Namespace confirma do WSDL real SP: NFeStatusServico4 (NF maiúsculo)
  const soapAction = '"http://www.portalfiscal.inf.br/nfe/wsdl/NFeStatusServico4/nfeStatusServicoNF"'
  const soapBody = buildNfeStatusServicoSoap(params.cUF)

  try {
    const response = await fetchWithTimeout(
      params.endpoint,
      {
        method: 'POST',
        headers: {
          'Content-Type': `application/soap+xml; charset=utf-8; action=${soapAction}`,
          SOAPAction: soapAction,
        },
        body: soapBody,
      },
      params.certData,
    )
    const responseText = await response.text()
    return parseStatusResponse(responseText)
  } catch {
    return { ok: false, message: 'SEFAZ NF-e não respondeu ao status' }
  }
}

// ─── Consulta de situação por chave (consSitNFe) ────────────────────────────
export type ConsultaResult = {
  situacao: string
  descricao: string
  autorizada: boolean
  cancelada: boolean
  protocolo?: string
  chaveAcesso: string
  rawResponse: unknown
}

export async function sendConsultaProtocolo(params: {
  endpoint: string
  cUF: string
  chaveAcesso: string
  tpAmb: string
  certData: CertificateData
}): Promise<ConsultaResult> {
  const isSp = params.endpoint.includes('fazenda.sp.gov.br')
  const ns = isSp
    ? 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeConsultaProtocolo4'
    : 'http://www.portalfiscal.inf.br/nfe/wsdl/NfceConsulta'
  const soapAction = `"${ns}/nfeConsultaNF"`
  const soapBody = `<?xml version="1.0" encoding="UTF-8"?><soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope"><soap12:Header><nfeCabecMsg xmlns="${ns}"><cUF>${params.cUF}</cUF><versaoDados>4.00</versaoDados></nfeCabecMsg></soap12:Header><soap12:Body><nfeDadosMsg xmlns="${ns}"><consSitNFe versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe"><tpAmb>${params.tpAmb}</tpAmb><xServ>CONSULTAR</xServ><chNFe>${params.chaveAcesso}</chNFe></consSitNFe></nfeDadosMsg></soap12:Body></soap12:Envelope>`

  const response = await fetchWithTimeout(
    params.endpoint,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/soap+xml; charset=utf-8', SOAPAction: soapAction },
      body: soapBody,
    },
    params.certData,
  )
  const soapXml = await response.text()
  const parsed = XML_PARSER.parse(soapXml)
  const ret =
    parsed?.Envelope?.Body?.nfceResultMsg?.retConsSitNFe ?? parsed?.Envelope?.Body?.nfeResultMsg?.retConsSitNFe
  const situacao = String(ret?.cStat ?? '')
  const descricao = String(ret?.xMotivo ?? '')
  const protocolo = ret?.protNFe?.infProt?.nProt ? String(ret.protNFe.infProt.nProt) : undefined
  // 101/151/155 = cancelamento homologado; 135 em procEventoNFe também indica cancelamento
  const eventos = JSON.stringify(ret?.procEventoNFe ?? '')
  const cancelada = ['101', '151', '155'].includes(situacao) || eventos.includes('110111')
  const autorizada = ['100', '150'].includes(situacao) && !cancelada
  return {
    situacao,
    descricao,
    autorizada,
    cancelada,
    protocolo,
    chaveAcesso: params.chaveAcesso,
    rawResponse: ret ?? soapXml,
  }
}

// ─── Carta de Correção Eletrônica (evento 110110) ───────────────────────────
export async function sendCartaCorrecao(params: {
  endpoint: string
  cUF: string
  chaveAcesso: string
  correcao: string
  cnpj: string
  dhEvento: string
  nSeqEvento: string
  tpAmb: string
  certData: CertificateData
}): Promise<FiscalResult> {
  const id = `ID110110${params.chaveAcesso}${params.nSeqEvento.padStart(2, '0')}`
  const xCondUso =
    'A Carta de Correcao e disciplinada pelo paragrafo 1o-A do art. 7o do Convenio S/N, de 15 de dezembro de 1970 e pode ser utilizada para regularizacao de erro ocorrido na emissao de documento fiscal, desde que o erro nao esteja relacionado com: I - as variaveis que determinam o valor do imposto tais como: base de calculo, aliquota, diferenca de preco, quantidade, valor da operacao ou da prestacao; II - a correcao de dados cadastrais que implique mudanca do remetente ou do destinatario; III - a data de emissao ou de saida.'
  const unsignedXml = `<envEvento versao="1.00" xmlns="http://www.portalfiscal.inf.br/nfe"><idLote>1</idLote><evento versao="1.00"><infEvento Id="${id}"><cOrgao>${params.cUF}</cOrgao><tpAmb>${params.tpAmb}</tpAmb><CNPJ>${params.cnpj.replace(/\D/g, '')}</CNPJ><chNFe>${params.chaveAcesso}</chNFe><dhEvento>${params.dhEvento}</dhEvento><tpEvento>110110</tpEvento><nSeqEvento>${params.nSeqEvento}</nSeqEvento><verEvento>1.00</verEvento><detEvento versao="1.00"><descEvento>Carta de Correcao</descEvento><xCorrecao>${params.correcao}</xCorrecao><xCondUso>${xCondUso}</xCondUso></detEvento></infEvento></evento></envEvento>`
  const { signedXml } = signNfeEventoXml(unsignedXml, params.certData)
  const eventoXml = signedXml.replace(/^<\?xml[^?]*\?>\s*/i, '')
  const soapBody = buildEventoSoapEnvelope({ cUF: params.cUF, eventoXml })

  const response = await fetchWithTimeout(
    params.endpoint,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/soap+xml; charset=utf-8',
        SOAPAction: '"http://www.portalfiscal.inf.br/nfe/wsdl/NfceRecepcaoEvento4/nfceRecepcaoEvento"',
      },
      body: soapBody,
    },
    params.certData,
  )
  return parseSefazEventoResponse(await response.text())
}

// ─── Inutilização de numeração (inutNFe) ─────────────────────────────────────
export async function sendInutilizacao(params: {
  endpoint: string
  cUF: string
  ano: string
  cnpj: string
  mod: string
  serie: string
  numeroInicial: string
  numeroFinal: string
  justificativa: string
  tpAmb: string
  certData: CertificateData
}): Promise<FiscalResult> {
  const cnpj = params.cnpj.replace(/\D/g, '')
  const serie3 = params.serie.padStart(3, '0')
  const ini9 = params.numeroInicial.padStart(9, '0')
  const fin9 = params.numeroFinal.padStart(9, '0')
  const id = `ID${params.cUF}${params.ano}${cnpj}${params.mod}${serie3}${ini9}${fin9}`
  const unsignedXml = `<inutNFe versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe"><infInut Id="${id}"><tpAmb>${params.tpAmb}</tpAmb><xServ>INUTILIZAR</xServ><cUF>${params.cUF}</cUF><ano>${params.ano}</ano><CNPJ>${cnpj}</CNPJ><mod>${params.mod}</mod><serie>${params.serie}</serie><nNFIni>${params.numeroInicial}</nNFIni><nNFFin>${params.numeroFinal}</nNFFin><xJust>${params.justificativa}</xJust></infInut></inutNFe>`
  const { signedXml } = signInutNFeXml(unsignedXml, params.certData)
  const inutFragment = signedXml.replace(/^<\?xml[^?]*\?>\s*/i, '')
  const isSp = params.endpoint.includes('fazenda.sp.gov.br')
  const ns = isSp
    ? 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeInutilizacao4'
    : 'http://www.portalfiscal.inf.br/nfe/wsdl/NfceInutilizacao4'
  const soapBody = `<?xml version="1.0" encoding="UTF-8"?><soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope"><soap12:Header><nfeCabecMsg xmlns="${ns}"><cUF>${params.cUF}</cUF><versaoDados>4.00</versaoDados></nfeCabecMsg></soap12:Header><soap12:Body><nfeDadosMsg xmlns="${ns}">${inutFragment}</nfeDadosMsg></soap12:Body></soap12:Envelope>`

  const response = await fetchWithTimeout(
    params.endpoint,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/soap+xml; charset=utf-8', SOAPAction: `"${ns}/nfeInutilizacaoNF"` },
      body: soapBody,
    },
    params.certData,
  )
  const soapXml = await response.text()
  const parsed = XML_PARSER.parse(soapXml)
  const ret = parsed?.Envelope?.Body?.nfceResultMsg?.retInutNFe ?? parsed?.Envelope?.Body?.nfeResultMsg?.retInutNFe
  const infInut = ret?.infInut
  const cStat = String(infInut?.cStat ?? ret?.cStat ?? '')
  const xMotivo = String(infInut?.xMotivo ?? ret?.xMotivo ?? '')
  if (cStat === '102') {
    return { success: true, protocolo: String(infInut?.nProt ?? ''), rawResponse: ret ?? soapXml }
  }
  return {
    success: false,
    errorCode: cStat || 'INUT_PARSE_ERROR',
    errorMessage: xMotivo || 'Inutilização rejeitada',
    rawResponse: ret ?? soapXml,
  }
}

// ─── HTTP ─────────────────────────────────────────────────────────────────────

async function fetchWithTimeout(url: string, options: RequestInit, certData: CertificateData): Promise<Response> {
  const headers: Record<string, string> = {}
  if (options.headers) {
    const h = new Headers(options.headers)
    h.forEach((value, key) => {
      headers[key] = value
    })
  }
  return sefazFetch(
    url,
    {
      method: options.method,
      headers,
      body: typeof options.body === 'string' ? options.body : undefined,
      signal: options.signal ?? undefined,
    },
    certData,
    REQUEST_TIMEOUT_MS,
    'SEFAZ',
  )
}
