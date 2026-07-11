import type { FiscalProvider } from '../FiscalProvider.interface'
import type {
  EmitFiscalParams,
  CancelFiscalParams,
  TestConnectionParams,
  FiscalResult,
  TestConnectionResult,
  NfeConfig,
} from '../types'
import { buildChaveAcesso } from '../sefaz/SefazChave'
import { buildNfeXml } from '../sefaz/NfeXmlBuilder'
import { loadCertificate, isCertificateCached, signNfceXml, type CertificateData } from '../sefaz/SefazXmlSigner'
import { getNfeUrls } from '../sefaz/NfeConstants'
import { UF_IBGE_CODES } from '../sefaz/SefazConstants'
import { resolveErrorHint } from '../sefaz/SefazCstatHints'
import {
  CANCEL_TIMING_REJECT_CODES,
  CANCEL_MAX_ATTEMPTS,
  CANCEL_RETRY_DELAY_MS,
  cancelEventoDate,
  cancelSleep,
} from '../sefaz/SefazCancelTiming'
import { sendNfeAutorizacao, sendNfeCancelamento, sendNfeStatusServico } from '../sefaz/SefazSoapClient'
import { withRetry } from '../sefaz/SefazRetry'
import { FiscalError } from '../errors/FiscalError'
import { CERT_LOG, NFE_LOG } from '../sefaz/SefazLogMessages.constant'
import { obfuscateMeta } from '../sefaz/LogObfuscator'
import { assertValidFiscalItems } from '../validation/FiscalItemValidator'

const APP_NAME = 'fiscal-provider:sefaz-nfe'

type LogLevel = 'info' | 'warn' | 'error'

function log(level: LogLevel, message: string, meta: Record<string, unknown> = {}): void {
  const entry = {
    timestamp: new Date().toISOString(),
    app: APP_NAME,
    level: level.toUpperCase(),
    message,
    ...obfuscateMeta(meta),
  }
  if (level === 'error') {
    console.error(JSON.stringify(entry))
  } else {
    console.log(JSON.stringify(entry))
  }
}

function assertNfeConfig(config: unknown): asserts config is NfeConfig {
  const c = config as NfeConfig
  if (!c || c.model !== 'nfe') {
    throw new FiscalError('Configuração inválida: modelo deve ser "nfe"', 'INVALID_CONFIG', 'model mismatch', null)
  }
  if (!c.certificadoBase64 || !c.certificadoSenha) {
    throw new FiscalError(
      'Certificado A1 não configurado (certificadoBase64/certificadoSenha ausente)',
      'MISSING_CERT',
      'env vars SEFAZ_CERT_BASE64 / SEFAZ_CERT_SENHA not set',
      null,
    )
  }
}

export class SefazNfeProvider implements FiscalProvider {
  async emit(params: EmitFiscalParams): Promise<FiscalResult> {
    const { config } = params
    assertNfeConfig(config)
    assertValidFiscalItems({ items: params.items, crt: config.crt })

    if (!params.nfeData) {
      log('warn', NFE_LOG.NFEDATA_MISSING, { traceId: params.referenceId })
      return {
        success: false,
        errorCode: 'MISSING_NFE_DATA',
        errorMessage: 'nfeData é obrigatório para emissão de NF-e — informe destinatario, naturezaOperacao, etc.',
        rawResponse: null,
      }
    }

    const traceId = params.referenceId
    const dataEmissao = new Date()
    const env = config.environment

    log('info', NFE_LOG.EMIT_START, { traceId, uf: config.uf, cnpj: config.cnpj, environment: env })

    const certData = loadCertificateOrThrow(config, traceId)

    const chave = buildChaveAcesso({
      uf: config.uf,
      dataEmissao,
      cnpj: config.cnpj,
      serie: config.serie,
      numeroNf: config.numeroNf,
      mod: '55',
    })
    log('info', NFE_LOG.CHAVE_GERADA, { traceId, chaveAcesso: chave.chave })

    const nfeXml = buildNfeXml({ params, config, nfeData: params.nfeData, chave, dataEmissao })
    log('info', NFE_LOG.XML_GERADO, {
      traceId,
      items: params.items.length,
      totalAmount: params.items.reduce((sum, item) => sum + item.valorUnitario * item.quantidade, 0).toFixed(2),
    })

    const signedResult = signXmlOrThrow(nfeXml, certData, traceId)

    const urls = getNfeUrls(config.uf, env)
    const cUF = UF_IBGE_CODES[config.uf] ?? '00'

    log('info', NFE_LOG.EMIT_ENVIANDO, { traceId, endpoint: urls.autorizacao, environment: env, uf: config.uf })

    const result = await withRetry(
      (attempt) => {
        if (attempt > 1) log('warn', `Retentativa ${attempt} de envio para SEFAZ NF-e`, { traceId, attempt })
        return sendNfeAutorizacao({
          endpoint: urls.autorizacao,
          cUF,
          signedNfeXml: signedResult.signedXml,
          loteId: chave.cNF,
          wsdlNamespace: urls.wsdlNamespace,
          certData,
        })
      },
      {
        operationName: 'SEFAZ NF-e autorizacao',
        logger: { warn: (message, meta) => log('warn', message, meta ?? {}) },
      },
    )

    const xmlAutorizado =
      result.success && result.xmlProtocolo
        ? `<?xml version="1.0" encoding="UTF-8"?><nfeProc versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe">${signedResult.signedXml.replace(/^<\?xml[^?]*\?>\s*/i, '')}${result.xmlProtocolo}</nfeProc>`
        : undefined

    const finalResult: FiscalResult = {
      ...result,
      chaveAcesso: result.chaveAcesso ?? chave.chave,
      serie: config.serie,
      numeroDocumento: config.numeroNf,
      xmlAutorizado,
      errorHint: resolveErrorHint(result.errorCode, config.environment),
    }

    if (finalResult.success) {
      log('info', NFE_LOG.EMIT_SUCCESS, {
        traceId,
        chaveAcesso: finalResult.chaveAcesso,
        protocolo: finalResult.protocolo,
      })
    } else {
      log('error', NFE_LOG.EMIT_REJECTED, {
        traceId,
        errorCode: finalResult.errorCode,
        errorMessage: finalResult.errorMessage,
        rawResponse:
          typeof finalResult.rawResponse === 'string' ? finalResult.rawResponse.slice(0, 600) : finalResult.rawResponse,
      })
    }

    return finalResult
  }

  async cancel(params: CancelFiscalParams): Promise<FiscalResult> {
    const { config } = params
    assertNfeConfig(config)

    if (!params.chaveAcesso || params.chaveAcesso.replace(/\D/g, '').length !== 44) {
      log('warn', NFE_LOG.CANCEL_CHAVE_INVALID, {
        chaveAcesso: params.chaveAcesso,
        tamanho: params.chaveAcesso?.replace(/\D/g, '').length ?? 0,
      })
      return {
        success: false,
        errorCode: 'INVALID_CHAVE',
        errorMessage: `chaveAcesso inválida: deve ter exatamente 44 dígitos numéricos (recebido: "${params.chaveAcesso}")`,
        rawResponse: null,
      }
    }

    if (!params.protocolo || params.protocolo.trim() === '') {
      log('warn', NFE_LOG.CANCEL_PROTOCOLO_MISSING, {
        chaveAcesso: params.chaveAcesso,
      })
      return {
        success: false,
        errorCode: 'MISSING_PROTOCOLO',
        errorMessage: 'protocolo é obrigatório para cancelamento de NF-e',
        rawResponse: null,
      }
    }

    if (!params.justificativa || params.justificativa.trim().length < 15) {
      log('warn', NFE_LOG.CANCEL_JUSTIFICATIVA_SHORT, {
        chaveAcesso: params.chaveAcesso,
        tamanho: params.justificativa?.trim().length ?? 0,
      })
      return {
        success: false,
        errorCode: 'INVALID_JUSTIFICATIVA',
        errorMessage: `justificativa muito curta: SEFAZ exige mínimo 15 caracteres (recebido: ${params.justificativa?.trim().length ?? 0})`,
        rawResponse: null,
      }
    }

    const traceId = params.chaveAcesso
    const protocolo = params.protocolo as string

    log('info', NFE_LOG.CANCEL_START, { traceId, chaveAcesso: params.chaveAcesso })

    const certData = loadCertificateOrThrow(config, traceId)
    const urls = getNfeUrls(config.uf, config.environment)
    const cUF = UF_IBGE_CODES[config.uf] ?? '00'
    const tpAmb = config.environment === 'producao' ? '1' : '2'

    let result!: FiscalResult
    for (let tentativa = 1; tentativa <= CANCEL_MAX_ATTEMPTS; tentativa++) {
      // dhEvento com buffer no passado (contra clock skew), recalculado a cada tentativa
      const dhEvento = formatSefazDateTime(cancelEventoDate())
      result = await withRetry(
        (attempt) => {
          if (attempt > 1) log('warn', `Retentativa ${attempt} de cancelamento NF-e`, { traceId, attempt })
          return sendNfeCancelamento({
            endpoint: urls.recepcaoEvento,
            cUF,
            chaveAcesso: params.chaveAcesso,
            protocolo,
            justificativa: params.justificativa,
            cnpj: config.cnpj,
            dhEvento,
            nSeqEvento: '1',
            tpAmb,
            certData,
          })
        },
        {
          operationName: 'SEFAZ cancelamento NF-e',
          logger: { warn: (message, meta) => log('warn', message, meta ?? {}) },
        },
      )

      if (result.success || !CANCEL_TIMING_REJECT_CODES.has(result.errorCode ?? '')) break
      if (tentativa < CANCEL_MAX_ATTEMPTS) {
        log('warn', `Cancelamento NF-e rejeitado por data (cStat ${result.errorCode}) — reagendando dhEvento`, {
          traceId,
          tentativa,
        })
        await cancelSleep(CANCEL_RETRY_DELAY_MS)
      }
    }

    if (result.success) {
      log('info', NFE_LOG.CANCEL_SUCCESS, { traceId, protocolo: result.protocolo })
    } else {
      log('error', NFE_LOG.CANCEL_REJECTED, {
        traceId,
        errorCode: result.errorCode,
        errorMessage: result.errorMessage,
        rawResponse: typeof result.rawResponse === 'string' ? result.rawResponse.slice(0, 600) : result.rawResponse,
      })
    }

    return result
  }

  async testConnection(params: TestConnectionParams): Promise<TestConnectionResult> {
    const { config } = params
    assertNfeConfig(config)

    const certData = loadCertificateOrThrow(config, 'testConnection')
    const urls = getNfeUrls(config.uf, config.environment)
    const cUF = UF_IBGE_CODES[config.uf] ?? '00'

    log('info', NFE_LOG.STATUS_CHECK, { uf: config.uf, environment: config.environment })

    const status = await sendNfeStatusServico({ endpoint: urls.statusServico, cUF, certData })

    log(status.ok ? 'info' : 'warn', NFE_LOG.STATUS_RESULT, {
      uf: config.uf,
      environment: config.environment,
      ok: status.ok,
      message: status.message,
    })

    return status
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function loadCertificateOrThrow(config: NfeConfig, traceId: string): CertificateData {
  const fromCache = isCertificateCached(config.certificadoBase64, config.certificadoSenha)
  try {
    const certData = loadCertificate(config.certificadoBase64, config.certificadoSenha)
    log('info', CERT_LOG.LOADED, { traceId, fromCache })
    return certData
  } catch (error) {
    log('error', CERT_LOG.LOAD_ERROR, {
      traceId,
      error: error instanceof Error ? error.message : String(error),
    })
    throw error
  }
}

function signXmlOrThrow(xml: string, certData: CertificateData, traceId: string) {
  try {
    const result = signNfceXml(xml, certData)
    log('info', NFE_LOG.XML_ASSINADO, { traceId })
    return result
  } catch (error) {
    log('error', NFE_LOG.XML_SIGN_ERROR, {
      traceId,
      error: error instanceof Error ? error.message : String(error),
    })
    throw error
  }
}

function formatSefazDateTime(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}-03:00`
}
