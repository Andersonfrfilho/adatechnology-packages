import { XMLParser } from 'fast-xml-parser'
import { FiscalError } from '../errors/FiscalError'
import type { FiscalResult } from '../types'
import { SEFAZ_RETRYABLE_CODES } from './SefazConstants'
import { signNfeEventoXml } from './SefazXmlSigner'
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
  parseTagValue: false,   // mantém valores como string — evita chave 44 dígitos virar notação científica
})

export async function sendNfceAutorizacao(params: SoapSendParams): Promise<FiscalResult> {
  const soapBody = buildSoapEnvelope(params)
  // SP usa WSDL NFeAutorizacao4 (método nfeAutorizacaoLote); demais UFs usam NfceAutorizacao4
  const method = params.wsdlNamespace.includes('NFeAutorizacao4')
    ? 'nfeAutorizacaoLote'
    : 'nfceAutorizacaoNF'
  const soapAction = `"${params.wsdlNamespace}/${method}"`

  const response = await fetchWithTimeout(
    params.endpoint,
    {
      method: 'POST',
      headers: {
        'Content-Type': `application/soap+xml; charset=utf-8; action=${soapAction}`,
        'SOAPAction': soapAction,
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
        'SOAPAction': '"http://www.portalfiscal.inf.br/nfe/wsdl/NfceRecepcaoEvento4/nfceRecepcaoEvento"',
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
  /** Namespace WSDL — SP usa NFeStatusServico4; demais NfceStatusServico4 */
  wsdlNamespace?: string
}): Promise<{ ok: boolean; message: string }> {
  const ns =
    params.wsdlNamespace ??
    (params.endpoint.includes('nfce.fazenda.sp.gov.br')
      ? 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeStatusServico4'
      : 'http://www.portalfiscal.inf.br/nfe/wsdl/NfceStatusServico4')
  const soapBody = buildStatusServicoSoap(params.cUF, ns)
  const method = ns.includes('NFeStatusServico4') ? 'nfeStatusServicoNF' : 'nfceStatusServico'
  const soapAction = `"${ns}/${method}"`

  try {
    const response = await fetchWithTimeout(
      params.endpoint,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/soap+xml; charset=utf-8',
          'SOAPAction': soapAction,
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

function buildStatusServicoSoap(cUF: string, wsdlNamespace = 'http://www.portalfiscal.inf.br/nfe/wsdl/NfceStatusServico4'): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
  <soap12:Header>
    <nfeCabecMsg xmlns="${wsdlNamespace}">
      <cUF>${cUF}</cUF><versaoDados>4.00</versaoDados>
    </nfeCabecMsg>
  </soap12:Header>
  <soap12:Body>
    <nfeDadosMsg xmlns="${wsdlNamespace}">
      <consStatServ versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe">
        <tpAmb>2</tpAmb><cUF>${cUF}</cUF><xServ>STATUS</xServ>
      </consStatServ>
    </nfeDadosMsg>
  </soap12:Body>
</soap12:Envelope>`
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

function parseStatusResponse(soapXml: string): { ok: boolean; message: string } {
  try {
    if (soapXml.trimStart().startsWith('<') && soapXml.includes('<html')) {
      const isNotFound = soapXml.includes('resource cannot be found') || soapXml.includes('404')
      const isForbidden = soapXml.includes('403') || soapXml.includes('Forbidden') || soapXml.includes('Access is denied')
      if (isNotFound) {
        return {
          ok: false,
          message: 'SEFAZ retornou HTML 404 — certificado rejeitado na camada de aplicação (OU=VideoConferencia não autorizado para NFC-e/NF-e). Necessário e-CNPJ A1 de uso fiscal.',
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
    const retStatus = body?.nfceResultMsg?.retConsStatServ
                   ?? body?.nfeResultMsg?.retConsStatServ
    const cStat = String(retStatus?.cStat ?? '')
    const xMotivo = String(retStatus?.xMotivo ?? '')

    if (!cStat) {
      return {
        ok: false,
        message: `Resposta de status inesperada — cStat ausente. Primeiros 300 chars: ${soapXml.slice(0, 300)}`,
      }
    }

    if (cStat !== '107') {
      return { ok: false, message: `SEFAZ fora do ar [${cStat}]: ${xMotivo || 'sem descrição'}` }
    }

    return { ok: true, message: xMotivo || 'Serviço em operação' }
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
        'SOAPAction': soapAction,
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
        'SOAPAction': '"http://www.portalfiscal.inf.br/nfe/wsdl/NFeRecepcaoEvento4/nfeRecepcaoEvento"',
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
}): Promise<{ ok: boolean; message: string }> {
  // Namespace confirma do WSDL real SP: NFeStatusServico4 (NF maiúsculo)
  const soapAction = '"http://www.portalfiscal.inf.br/nfe/wsdl/NFeStatusServico4/nfeStatusServicoNF"'
  const soapBody   = buildNfeStatusServicoSoap(params.cUF)

  try {
    const response = await fetchWithTimeout(
      params.endpoint,
      {
        method: 'POST',
        headers: {
          'Content-Type': `application/soap+xml; charset=utf-8; action=${soapAction}`,
          'SOAPAction': soapAction,
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

// ─── HTTP ─────────────────────────────────────────────────────────────────────

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  certData: CertificateData,
): Promise<Response> {
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
