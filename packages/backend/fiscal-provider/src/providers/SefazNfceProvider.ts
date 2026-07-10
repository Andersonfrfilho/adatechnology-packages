import type { FiscalProvider } from '../FiscalProvider.interface'
import type {
  EmitFiscalParams,
  CancelFiscalParams,
  TestConnectionParams,
  FiscalResult,
  TestConnectionResult,
  NfceConfig,
} from '../types'
import { buildChaveAcesso } from '../sefaz/SefazChave'
import { buildNfceXml } from '../sefaz/SefazXmlBuilder'
import { buildQrCodeUrl, buildInfNFeSupl } from '../sefaz/SefazQrCode'
import { buildDanfce } from '../danfce/DanfceBuilder'
import { buildCupomPdf } from '../danfce/CupomPdfBuilder'
import { loadCertificate, isCertificateCached, signNfceXml, type CertificateData } from '../sefaz/SefazXmlSigner'
import { getSefazUrls, getSefazQrCodeInfo, UF_IBGE_CODES, isNfceSupported } from '../sefaz/SefazConstants'
import { sendNfceAutorizacao, sendNfceCancelamento, sendStatusServico } from '../sefaz/SefazSoapClient'
import { withRetry } from '../sefaz/SefazRetry'
import { FiscalError } from '../errors/FiscalError'
import { CERT_LOG, NFCE_LOG } from '../sefaz/SefazLogMessages.constant'
import { obfuscateMeta } from '../sefaz/LogObfuscator'

const APP_NAME = 'fiscal-provider:sefaz-nfce'

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

function assertNfceConfig(config: unknown): asserts config is NfceConfig {
  const c = config as NfceConfig
  if (!c || c.model !== 'nfce') {
    throw new FiscalError('Configuração inválida: modelo deve ser "nfce"', 'INVALID_CONFIG', 'model mismatch', null)
  }
  if (!isNfceSupported(c.uf)) {
    const guidance: Record<string, string> = {
      CE: 'CE utiliza MFE — Módulo Fiscal Eletrônico (equipamento estadual equivalente ao SAT) e NF-e modelo 55 para demais vendas.',
    }
    const hint = guidance[c.uf.toUpperCase()] ?? 'Consulte a legislação estadual para o modelo fiscal correto.'
    throw new FiscalError(
      `NFC-e (modelo 65) não é suportado no estado ${c.uf}. ${hint}`,
      'UF_NOT_SUPPORTED',
      `uf=${c.uf} não aderiu ao NFC-e`,
      null,
    )
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

export class SefazNfceProvider implements FiscalProvider {
  async emit(params: EmitFiscalParams): Promise<FiscalResult> {
    const { config } = params
    assertNfceConfig(config)

    const traceId = params.referenceId
    const dataEmissao = new Date()
    const env = config.environment

    log('info', NFCE_LOG.EMIT_START, { traceId, uf: config.uf, cnpj: config.cnpj, environment: env })

    const certData = loadCertificateOrThrow(config, traceId)

    const chave = buildChaveAcesso({
      uf: config.uf,
      dataEmissao,
      cnpj: config.cnpj,
      serie: config.serie,
      numeroNf: config.numeroNf,
    })
    log('info', NFCE_LOG.CHAVE_GERADA, { traceId, chaveAcesso: chave.chave })

    const tpAmb = env === 'producao' ? '1' : '2'
    const qrCodeUrls = getSefazQrCodeInfo(config.uf, env)

    const qrCodeUrl = buildQrCodeUrl({
      chave,
      cscId: config.cscId,
      cscToken: config.cscToken,
      uf: config.uf,
      environment: env,
      tpAmb,
    })

    const nfceXml = buildNfceXml({ params, config, chave, dataEmissao })
    log('info', NFCE_LOG.XML_GERADO, {
      traceId,
      items: params.items.length,
      totalAmount: params.items.reduce((sum, item) => sum + item.valorUnitario * item.quantidade, 0).toFixed(2),
    })

    const signedResult = signXmlOrThrow(nfceXml, certData, traceId)

    const infNFeSupl = buildInfNFeSupl(qrCodeUrl, qrCodeUrls.urlFe)
    // Compactar: SP rejeita whitespace entre tags (cStat 225)
    const finalXml = compactXml(
      signedResult.signedXml.replace('<Signature', `${infNFeSupl}<Signature`),
    )

    const urls = getSefazUrls(config.uf, env)
    const cUF = UF_IBGE_CODES[config.uf] ?? '00'

    log('info', NFCE_LOG.EMIT_ENVIANDO, {
      traceId,
      endpoint: urls.autorizacao,
      environment: env,
      uf: config.uf,
    })

    const result = await withRetry(
      (attempt) => {
        if (attempt > 1) {
          log('warn', `Retentativa ${attempt} de envio para SEFAZ`, { traceId, attempt })
        }
        return sendNfceAutorizacao({
          endpoint: urls.autorizacao,
          cUF,
          signedNfeXml: finalXml,
          loteId: chave.cNF,
          wsdlNamespace: urls.wsdlNamespace,
          certData,
        })
      },
      {
        operationName: 'SEFAZ NFC-e autorizacao',
        logger: { warn: (message, meta) => log('warn', message, meta ?? {}) },
      },
    )

    const finalResult: FiscalResult = {
      ...result,
      chaveAcesso: result.chaveAcesso ?? chave.chave,
      serie: config.serie,
      numeroDocumento: config.numeroNf,
      qrCodeUrl,
    }

    if (finalResult.success) {
      log('info', NFCE_LOG.EMIT_SUCCESS, {
        traceId,
        chaveAcesso: finalResult.chaveAcesso,
        protocolo: finalResult.protocolo,
      })
    } else {
      log('error', NFCE_LOG.EMIT_REJECTED, {
        traceId,
        errorCode: finalResult.errorCode,
        errorMessage: finalResult.errorMessage,
        rawResponse:
          typeof finalResult.rawResponse === 'string' ? finalResult.rawResponse.slice(0, 600) : finalResult.rawResponse,
      })
    }

    const danfce = buildDanfce({
      emitParams: params,
      config,
      result: finalResult,
      qrCodeUrl,
      urlConsulta: qrCodeUrls.urlFe,
      dataEmissao,
    })

    let cupomPdf: Awaited<ReturnType<typeof buildCupomPdf>> | undefined
    if (finalResult.success) {
      cupomPdf = await buildCupomPdf({
        emitParams: params,
        config,
        result: finalResult,
        qrCodePayload: qrCodeUrl,
        urlConsulta: qrCodeUrls.urlFe,
        dataEmissao,
      })
    }

    return { ...finalResult, danfce, cupomPdf, qrCodeUrl }
  }

  async cancel(params: CancelFiscalParams): Promise<FiscalResult> {
    const { config } = params
    assertNfceConfig(config)

    if (!params.chaveAcesso || params.chaveAcesso.replace(/\D/g, '').length !== 44) {
      log('warn', NFCE_LOG.CANCEL_CHAVE_INVALID, {
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
      log('warn', NFCE_LOG.CANCEL_PROTOCOLO_MISSING, {
        chaveAcesso: params.chaveAcesso,
      })
      return {
        success: false,
        errorCode: 'MISSING_PROTOCOLO',
        errorMessage:
          'protocolo é obrigatório para cancelamento — use o nProt retornado pela SEFAZ na autorização original',
        rawResponse: null,
      }
    }

    if (!params.justificativa || params.justificativa.trim().length < 15) {
      log('warn', NFCE_LOG.CANCEL_JUSTIFICATIVA_SHORT, {
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

    log('info', NFCE_LOG.CANCEL_START, { traceId, chaveAcesso: params.chaveAcesso })

    const certData = loadCertificateOrThrow(config, traceId)
    const urls = getSefazUrls(config.uf, config.environment)
    const cUF = UF_IBGE_CODES[config.uf] ?? '00'
    const dhEvento = formatSefazDateTime(new Date())
    const tpAmb = config.environment === 'producao' ? '1' : '2'

    const result = await withRetry(
      (attempt) => {
        if (attempt > 1) {
          log('warn', `Retentativa ${attempt} de cancelamento no SEFAZ`, { traceId, attempt })
        }
        return sendNfceCancelamento({
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
        operationName: 'SEFAZ cancelamento NFC-e',
        logger: { warn: (message, meta) => log('warn', message, meta ?? {}) },
      },
    )

    if (result.success) {
      log('info', NFCE_LOG.CANCEL_SUCCESS, { traceId, protocolo: result.protocolo })
    } else {
      log('error', NFCE_LOG.CANCEL_REJECTED, {
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
    assertNfceConfig(config)

    const certData = loadCertificateOrThrow(config, 'testConnection')
    const urls = getSefazUrls(config.uf, config.environment)
    const cUF = UF_IBGE_CODES[config.uf] ?? '00'

    log('info', NFCE_LOG.STATUS_CHECK, { uf: config.uf, environment: config.environment })

    const status = await sendStatusServico({
      endpoint: urls.statusServico,
      cUF,
      certData,
      wsdlNamespace: urls.wsdlNamespace.includes('NFeAutorizacao4')
        ? 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeStatusServico4'
        : undefined,
    })

    log(status.ok ? 'info' : 'warn', NFCE_LOG.STATUS_RESULT, {
      uf: config.uf,
      environment: config.environment,
      ok: status.ok,
      message: status.message,
    })

    return status
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function loadCertificateOrThrow(config: NfceConfig, traceId: string): CertificateData {
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
    log('info', NFCE_LOG.XML_ASSINADO, { traceId })
    return result
  } catch (error) {
    log('error', NFCE_LOG.XML_SIGN_ERROR, {
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

/** Remove whitespace entre tags — exigido pela SEFAZ-SP (cStat 225). */
function compactXml(xml: string): string {
  return xml.replace(/>\s+</g, '><').trim()
}
