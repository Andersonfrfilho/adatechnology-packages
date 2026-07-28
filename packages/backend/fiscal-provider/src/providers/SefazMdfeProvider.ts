import type { FiscalProvider } from '../FiscalProvider.interface'
import type {
  CancelFiscalParams,
  CloseMdfeParams,
  EmitFiscalParams,
  FiscalResult,
  MdfeConfig,
  TestConnectionParams,
  TestConnectionResult,
} from '../types'
import { FiscalError } from '../errors/FiscalError'
import { UF_IBGE_CODES_CTE } from '../sefaz/CteConstants'
import { getMdfeUrls, MDFE_NS, MDFE_VERSAO } from '../sefaz/MdfeConstants'
import { buildMdfeCancelamentoXml, buildMdfeEncerramentoXml } from '../sefaz/MdfeEventoXmlBuilder'
import { buildMdfeXml } from '../sefaz/MdfeXmlBuilder'
import { sendMdfeAutorizacao, sendMdfeEvento, sendMdfeStatusServico } from '../sefaz/MdfeSoapClient'
import { formatSefazDateTime } from '../sefaz/SefazDateTime'
import { loadCertificate, signMdfeEventoXml, signMdfeXml } from '../sefaz/SefazXmlSigner'

const ACCESS_KEY_PATTERN = /^[0-9]{44}$/
const IBGE_CITY_PATTERN = /^[0-9]{7}$/
const ISO_DATE_PATTERN = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/
const MIN_JUSTIFICATIVA_LENGTH = 15
const MAX_JUSTIFICATIVA_LENGTH = 255

function log(level: 'info' | 'warn' | 'error', message: string, meta: Record<string, unknown> = {}): void {
  const entry = {
    timestamp: new Date().toISOString(),
    app: 'fiscal-provider:sefaz-mdfe',
    level: level.toUpperCase(),
    message,
    ...meta,
  }
  if (level === 'error') {
    process.stderr.write(JSON.stringify(entry) + '\n')
  } else {
    process.stdout.write(JSON.stringify(entry) + '\n')
  }
}

/** mdfeProc = MDF-e assinado + protMDFe cru da SEFAZ — é este XML que a lei manda guardar. */
function buildMdfeProc(signedXml: string, xmlProtocolo: string): string {
  const mdfeFragment = signedXml.replace(/^<\?xml[^?]*\?>\s*/i, '')
  return `<?xml version="1.0" encoding="UTF-8"?><mdfeProc versao="${MDFE_VERSAO}" xmlns="${MDFE_NS}">${mdfeFragment}${xmlProtocolo}</mdfeProc>`
}

function reject(errorCode: string, errorMessage: string): FiscalResult {
  return { success: false, errorCode, errorMessage, rawResponse: null }
}

function validateCloseParams(params: CloseMdfeParams): FiscalResult | undefined {
  if (!ACCESS_KEY_PATTERN.test(params.chaveAcesso)) {
    return reject('INVALID_CHAVE', 'Chave de acesso do MDF-e deve ter 44 dígitos')
  }
  if (!params.protocolo) {
    return reject('MISSING_PROTOCOLO', 'Protocolo de autorização é obrigatório para encerrar o MDF-e')
  }
  if (!IBGE_CITY_PATTERN.test(params.codigoMunicipioEncerramento)) {
    return reject('INVALID_MUNICIPIO_ENCERRAMENTO', 'Município de encerramento deve ser o código IBGE de 7 dígitos')
  }
  if (!UF_IBGE_CODES_CTE[params.ufEncerramento]) {
    return reject('INVALID_UF_ENCERRAMENTO', `UF de encerramento desconhecida: ${params.ufEncerramento}`)
  }
  if (!ISO_DATE_PATTERN.test(params.dataEncerramento)) {
    return reject('INVALID_DATA_ENCERRAMENTO', 'Data de encerramento deve estar no formato AAAA-MM-DD')
  }
  return undefined
}

function validateCancelParams(params: CancelFiscalParams): FiscalResult | undefined {
  if (!ACCESS_KEY_PATTERN.test(params.chaveAcesso)) {
    return reject('INVALID_CHAVE', 'Chave de acesso do MDF-e deve ter 44 dígitos')
  }
  if (!params.protocolo) {
    return reject('MISSING_PROTOCOLO', 'Protocolo de autorização é obrigatório para cancelar o MDF-e')
  }
  if (params.justificativa.trim().length < MIN_JUSTIFICATIVA_LENGTH) {
    return reject(
      'INVALID_JUSTIFICATIVA',
      `Justificativa de cancelamento exige no mínimo ${MIN_JUSTIFICATIVA_LENGTH} caracteres`,
    )
  }
  return undefined
}

export class SefazMdfeProvider implements FiscalProvider {
  async emit(params: EmitFiscalParams): Promise<FiscalResult> {
    const config = params.config as MdfeConfig
    const mdfeData = params.mdfeData

    if (!mdfeData) {
      return {
        success: false,
        errorCode: 'MISSING_MDFE_DATA',
        errorMessage: 'mdfeData é obrigatório para emitir MDF-e',
        rawResponse: null,
      }
    }

    const traceId = params.referenceId
    log('info', 'Iniciando emissão MDF-e via SEFAZ', { traceId })

    let certData: ReturnType<typeof loadCertificate>
    try {
      certData = loadCertificate(config.certificadoBase64, config.certificadoSenha)
      log('info', 'Certificado A1 carregado', { traceId })
    } catch (error) {
      throw new FiscalError(
        `Falha ao carregar certificado: ${error instanceof Error ? error.message : 'desconhecido'}`,
        'CERT_LOAD_ERROR',
        traceId,
        null,
      )
    }

    const { xml: unsignedXml, chaveAcesso } = buildMdfeXml(config, mdfeData)
    const { signedXml } = signMdfeXml(unsignedXml, certData)

    const urls = getMdfeUrls(config.environment)

    log('info', 'Transmitindo MDF-e', {
      traceId,
      chaveAcesso: `${chaveAcesso.slice(0, 6)}...${chaveAcesso.slice(-4)}`,
    })

    const result = await sendMdfeAutorizacao({
      endpoint: urls.autorizacao,
      signedMdfeXml: signedXml,
      certData,
    })

    const xmlAutorizado =
      result.success && result.xmlProtocolo ? buildMdfeProc(signedXml, result.xmlProtocolo) : undefined

    const finalResult: FiscalResult = {
      ...result,
      chaveAcesso: result.chaveAcesso || chaveAcesso,
      serie: config.serie,
      numeroDocumento: config.numeroMdfe,
      xmlAutorizado,
    }

    if (finalResult.success) {
      log('info', 'MDF-e autorizado com sucesso', {
        traceId,
        chaveAcesso: finalResult.chaveAcesso,
        protocolo: finalResult.protocolo,
        hasXmlAutorizado: xmlAutorizado !== undefined,
      })
    } else {
      log('error', 'MDF-e rejeitado pela SEFAZ', {
        traceId,
        errorCode: finalResult.errorCode,
        errorMessage: finalResult.errorMessage,
      })
    }

    return finalResult
  }

  /** Evento 110112 — encerra a viagem no fisco. MDF-e aberto trava a emissão do próximo. */
  async close(params: CloseMdfeParams): Promise<FiscalResult> {
    const config = params.config
    const rejection = validateCloseParams(params)
    if (rejection) {
      log('warn', 'Encerramento MDF-e recusado antes da SEFAZ', {
        traceId: params.chaveAcesso,
        errorCode: rejection.errorCode,
      })
      return rejection
    }

    let certData: ReturnType<typeof loadCertificate>
    try {
      certData = loadCertificate(config.certificadoBase64, config.certificadoSenha)
    } catch (error) {
      throw new FiscalError(
        `Falha ao carregar certificado: ${error instanceof Error ? error.message : 'desconhecido'}`,
        'CERT_LOAD_ERROR',
        params.chaveAcesso,
        null,
      )
    }

    const { xml } = buildMdfeEncerramentoXml({
      cOrgao: UF_IBGE_CODES_CTE[config.uf] ?? '35',
      tpAmb: config.environment === 'producao' ? '1' : '2',
      cnpj: config.cnpj,
      chaveAcesso: params.chaveAcesso,
      dhEvento: formatSefazDateTime(new Date()),
      nSeqEvento: params.sequenciaEvento ?? 1,
      protocolo: params.protocolo,
      dataEncerramento: params.dataEncerramento,
      cUfEncerramento: UF_IBGE_CODES_CTE[params.ufEncerramento] as string,
      codigoMunicipioEncerramento: params.codigoMunicipioEncerramento,
      ...(params.encerradoPorTerceiro === undefined ? {} : { encerradoPorTerceiro: params.encerradoPorTerceiro }),
    })
    const { signedXml } = signMdfeEventoXml(xml, certData)

    const result = await sendMdfeEvento({
      endpoint: getMdfeUrls(config.environment).recepcaoEvento,
      signedEventoXml: signedXml,
      certData,
    })

    log(result.success ? 'info' : 'error', 'Encerramento MDF-e processado', {
      traceId: params.chaveAcesso,
      success: result.success,
      protocolo: result.protocolo,
      errorCode: result.errorCode,
    })

    return result
  }

  /** Evento 110111 — cancela o manifesto. Depois do encerramento a SEFAZ recusa. */
  async cancel(params: CancelFiscalParams): Promise<FiscalResult> {
    const config = params.config as MdfeConfig
    const rejection = validateCancelParams(params)
    if (rejection) {
      log('warn', 'Cancelamento MDF-e recusado antes da SEFAZ', {
        traceId: params.chaveAcesso,
        errorCode: rejection.errorCode,
      })
      return rejection
    }

    let certData: ReturnType<typeof loadCertificate>
    try {
      certData = loadCertificate(config.certificadoBase64, config.certificadoSenha)
    } catch (error) {
      throw new FiscalError(
        `Falha ao carregar certificado: ${error instanceof Error ? error.message : 'desconhecido'}`,
        'CERT_LOAD_ERROR',
        params.chaveAcesso,
        null,
      )
    }

    const { xml } = buildMdfeCancelamentoXml({
      cOrgao: UF_IBGE_CODES_CTE[config.uf] ?? '35',
      tpAmb: config.environment === 'producao' ? '1' : '2',
      cnpj: config.cnpj,
      chaveAcesso: params.chaveAcesso,
      dhEvento: formatSefazDateTime(new Date()),
      nSeqEvento: 1,
      protocolo: params.protocolo as string,
      justificativa: params.justificativa.trim().slice(0, MAX_JUSTIFICATIVA_LENGTH),
    })
    const { signedXml } = signMdfeEventoXml(xml, certData)

    const result = await sendMdfeEvento({
      endpoint: getMdfeUrls(config.environment).recepcaoEvento,
      signedEventoXml: signedXml,
      certData,
    })

    log(result.success ? 'info' : 'error', 'Cancelamento MDF-e processado', {
      traceId: params.chaveAcesso,
      success: result.success,
      protocolo: result.protocolo,
      errorCode: result.errorCode,
    })

    return result
  }

  async testConnection(params: TestConnectionParams): Promise<TestConnectionResult> {
    const config = params.config as MdfeConfig

    try {
      const certData = loadCertificate(config.certificadoBase64, config.certificadoSenha)
      const urls = getMdfeUrls(config.environment)

      return await sendMdfeStatusServico({
        endpoint: urls.statusServico,
        tpAmb: config.environment === 'producao' ? '1' : '2',
        certData,
      })
    } catch (error) {
      return {
        ok: false,
        message: `Falha ao conectar SEFAZ MDF-e: ${error instanceof Error ? error.message : 'desconhecido'}`,
      }
    }
  }
}
