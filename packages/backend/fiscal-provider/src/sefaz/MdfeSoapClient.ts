import { gzipSync } from 'node:zlib'

import { XMLParser } from 'fast-xml-parser'

import type { FiscalResult } from '../types'
import { MDFE_NS, MDFE_SOAP_METHOD, MDFE_VERSAO, MDFE_WS_NS } from './MdfeConstants'
import type { CertificateData } from './SefazXmlSigner'
import { sefazFetch } from './SefazHttpClient'

const REQUEST_TIMEOUT_MS = 30_000
const CSTAT_AUTORIZADO = '100'
const CSTAT_SERVICO_EM_OPERACAO = '107'
const CSTAT_EVENTO_REGISTRADO = '135'

const XML_PARSER = new XMLParser({
  ignoreAttributes: false,
  removeNSPrefix: true,
  attributeNamePrefix: '',
  parseTagValue: false,
})

// ─── Senders ──────────────────────────────────────────────────────────────────

export async function sendMdfeAutorizacao(params: {
  endpoint: string
  signedMdfeXml: string
  certData: CertificateData
}): Promise<FiscalResult> {
  const ns = MDFE_WS_NS.recepcaoSinc
  const fragment = params.signedMdfeXml.replace(/^<\?xml[^?]*\?>\s*/i, '')

  // MDFeRecepcaoSinc: o WSDL declara mdfeDadosMsg como xsd:string e recebe o <MDFe> nu,
  // compactado em GZip e codificado em Base64 — sem o wrapper enviMDFe do fluxo assíncrono
  const payload = gzipSync(Buffer.from(fragment, 'utf8')).toString('base64')
  const soapBody = `<?xml version="1.0" encoding="UTF-8"?><soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope"><soap12:Body><mdfeDadosMsg xmlns="${ns}">${payload}</mdfeDadosMsg></soap12:Body></soap12:Envelope>`
  const soapAction = `"${ns}/${MDFE_SOAP_METHOD.recepcaoSinc}"`

  const response = await postSoap(params.endpoint, soapBody, soapAction, params.certData)
  const responseText = await response.text()

  if (!response.ok) {
    return {
      success: false,
      errorCode: `HTTP_${response.status}`,
      errorMessage: `SEFAZ MDF-e retornou HTTP ${response.status}: ${responseText.slice(0, 200)}`,
      rawResponse: responseText,
    }
  }

  return parseMdfeAutorizacaoResponse(responseText)
}

export async function sendMdfeEvento(params: {
  endpoint: string
  signedEventoXml: string
  certData: CertificateData
}): Promise<FiscalResult> {
  const ns = MDFE_WS_NS.recepcaoEvento
  const fragment = params.signedEventoXml.replace(/^<\?xml[^?]*\?>\s*/i, '')

  // O MDFeRecepcaoEvento recebe o evento cru — só o RecepcaoSinc compacta em GZip.
  // Nenhum serviço do MDF-e leva SOAP Header: não existe mdfeCabecMsg no WSDL 3.00.
  const soapBody = `<?xml version="1.0" encoding="UTF-8"?><soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope"><soap12:Body><mdfeDadosMsg xmlns="${ns}">${fragment}</mdfeDadosMsg></soap12:Body></soap12:Envelope>`
  const soapAction = `"${ns}/${MDFE_SOAP_METHOD.recepcaoEvento}"`

  const response = await postSoap(params.endpoint, soapBody, soapAction, params.certData)
  const responseText = await response.text()

  if (!response.ok) {
    return {
      success: false,
      errorCode: `HTTP_${response.status}`,
      errorMessage: `SEFAZ MDF-e retornou HTTP ${response.status}: ${responseText.slice(0, 200)}`,
      rawResponse: responseText,
    }
  }

  return parseMdfeEventoResponse(responseText, fragment)
}

export async function sendMdfeStatusServico(params: {
  endpoint: string
  cUF: string
  tpAmb: string
  certData: CertificateData
}): Promise<{ ok: boolean; message: string }> {
  const ns = MDFE_WS_NS.status
  const soapBody = `<?xml version="1.0" encoding="UTF-8"?><soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope"><soap12:Body><mdfeDadosMsg xmlns="${ns}"><consStatServMDFe versao="${MDFE_VERSAO}" xmlns="${MDFE_NS}"><tpAmb>${params.tpAmb}</tpAmb><cUF>${params.cUF}</cUF><xServ>STATUS</xServ></consStatServMDFe></mdfeDadosMsg></soap12:Body></soap12:Envelope>`
  const soapAction = `"${ns}/${MDFE_SOAP_METHOD.status}"`

  try {
    const response = await postSoap(params.endpoint, soapBody, soapAction, params.certData)
    const responseText = await response.text()

    // Certificado cliente não credenciado devolve 403 com HTML do IIS; sem esse corte o
    // parser não acha retConsStatServMDFe e reporta "fora do ar", escondendo a causa real.
    if (!response.ok) {
      return {
        ok: false,
        message: `SEFAZ MDF-e retornou HTTP ${response.status} — verifique se o certificado está credenciado para MDF-e neste ambiente`,
      }
    }

    return parseMdfeStatusResponse(responseText)
  } catch (error) {
    return {
      ok: false,
      message: `SEFAZ MDF-e não respondeu ao status: ${error instanceof Error ? error.message : 'desconhecido'}`,
    }
  }
}

// ─── Parsers ──────────────────────────────────────────────────────────────────

function parseMdfeAutorizacaoResponse(soapXml: string): FiscalResult {
  try {
    const parsed = XML_PARSER.parse(soapXml)
    const resultMsg = parsed?.Envelope?.Body?.mdfeResultMsg ?? parsed?.Envelope?.Body?.mdfeRecepcaoResult
    const retMDFe = resultMsg?.retMDFe ?? resultMsg?.retMDFeSinc

    const cStat = String(retMDFe?.cStat ?? '')
    const xMotivo = String(retMDFe?.xMotivo ?? '')

    if (cStat === CSTAT_AUTORIZADO) {
      const infProt = retMDFe?.protMDFe?.infProt
      return {
        success: true,
        chaveAcesso: String(infProt?.chMDFe ?? ''),
        protocolo: String(infProt?.nProt ?? ''),
        xmlProtocolo: soapXml.match(/<protMDFe[\s>][\s\S]*?<\/protMDFe>/)?.[0],
        rawResponse: retMDFe,
      }
    }

    return {
      success: false,
      errorCode: cStat || 'SEFAZ_UNKNOWN',
      errorMessage: xMotivo || `SEFAZ MDF-e retornou cStat ${cStat}`,
      rawResponse: retMDFe ?? soapXml,
    }
  } catch (error) {
    return {
      success: false,
      errorCode: 'PARSE_ERROR',
      errorMessage: `Erro ao interpretar resposta MDF-e: ${error instanceof Error ? error.message : 'desconhecido'}`,
      rawResponse: soapXml,
    }
  }
}

/** procEventoMDFe = evento assinado + retEventoMDFe cru. É o arquivo do evento que a lei manda guardar. */
function buildProcEventoMdfe(signedEventoXml: string, soapXml: string): string | undefined {
  const retEvento = soapXml.match(/<retEventoMDFe[\s>][\s\S]*?<\/retEventoMDFe>/)?.[0]
  if (retEvento === undefined) return undefined

  return `<?xml version="1.0" encoding="UTF-8"?><procEventoMDFe versao="${MDFE_VERSAO}" xmlns="${MDFE_NS}">${signedEventoXml}${retEvento}</procEventoMDFe>`
}

function parseMdfeEventoResponse(soapXml: string, signedEventoXml: string): FiscalResult {
  try {
    const parsed = XML_PARSER.parse(soapXml)
    const resultMsg = parsed?.Envelope?.Body?.mdfeResultMsg ?? parsed?.Envelope?.Body?.mdfeRecepcaoEventoResult
    // O retEventoMDFe do MDF-e traz infEvento direto; o CT-e interpõe um retEvento
    const infEvento = resultMsg?.retEventoMDFe?.infEvento

    const cStat = String(infEvento?.cStat ?? '')
    const xMotivo = String(infEvento?.xMotivo ?? '')

    if (cStat === CSTAT_EVENTO_REGISTRADO) {
      return {
        success: true,
        chaveAcesso: String(infEvento?.chMDFe ?? ''),
        protocolo: String(infEvento?.nProt ?? ''),
        xmlEvento: buildProcEventoMdfe(signedEventoXml, soapXml),
        rawResponse: infEvento,
      }
    }

    return {
      success: false,
      errorCode: cStat || 'EVENTO_PARSE_ERROR',
      errorMessage: xMotivo || `SEFAZ MDF-e recusou o evento: cStat ${cStat}`,
      rawResponse: infEvento ?? soapXml,
    }
  } catch (error) {
    return {
      success: false,
      errorCode: 'EVENTO_PARSE_ERROR',
      errorMessage: `Erro ao interpretar resposta de evento MDF-e: ${error instanceof Error ? error.message : 'desconhecido'}`,
      rawResponse: soapXml,
    }
  }
}

function parseMdfeStatusResponse(soapXml: string): { ok: boolean; message: string } {
  try {
    const parsed = XML_PARSER.parse(soapXml)
    const resultMsg = parsed?.Envelope?.Body?.mdfeResultMsg ?? parsed?.Envelope?.Body?.mdfeStatusServicoMDFResult
    const retStatus = resultMsg?.retConsStatServMDFe
    const cStat = String(retStatus?.cStat ?? '')
    const xMotivo = String(retStatus?.xMotivo ?? '')
    if (cStat === CSTAT_SERVICO_EM_OPERACAO) return { ok: true, message: xMotivo || 'Serviço MDF-e em operação' }
    return { ok: false, message: `SEFAZ MDF-e fora do ar [${cStat}]: ${xMotivo}` }
  } catch {
    return { ok: false, message: 'Falha ao interpretar status MDF-e' }
  }
}

// ─── HTTP ─────────────────────────────────────────────────────────────────────

async function postSoap(
  url: string,
  soapBody: string,
  soapAction: string,
  certData: CertificateData,
): Promise<Response> {
  return sefazFetch(
    url,
    {
      method: 'POST',
      headers: {
        'Content-Type': `application/soap+xml; charset=utf-8; action=${soapAction}`,
        SOAPAction: soapAction,
      },
      body: soapBody,
    },
    certData,
    REQUEST_TIMEOUT_MS,
    'SEFAZ MDF-e',
  )
}
