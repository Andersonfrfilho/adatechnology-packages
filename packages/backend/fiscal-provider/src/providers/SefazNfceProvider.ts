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
import { loadCertificate, signNfceXml, type CertificateData } from '../sefaz/SefazXmlSigner'
import { getSefazUrls, UF_IBGE_CODES } from '../sefaz/SefazConstants'
import { sendNfceAutorizacao, sendNfceCancelamento, sendStatusServico } from '../sefaz/SefazSoapClient'
import { withRetry } from '../sefaz/SefazRetry'
import { FiscalError } from '../errors/FiscalError'

const APP_NAME = 'fiscal-provider:sefaz-nfce'

type LogLevel = 'info' | 'warn' | 'error'

function log(level: LogLevel, message: string, meta: Record<string, unknown> = {}): void {
  const entry = {
    timestamp: new Date().toISOString(),
    app: APP_NAME,
    level: level.toUpperCase(),
    message,
    ...meta,
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
  if (!c.certificadoBase64 || !c.certificadoSenha) {
    throw new FiscalError('Certificado A1 não configurado (certificadoBase64/certificadoSenha ausente)', 'MISSING_CERT', 'env vars SEFAZ_CERT_BASE64 / SEFAZ_CERT_SENHA not set', null)
  }
}

export class SefazNfceProvider implements FiscalProvider {
  async emit(params: EmitFiscalParams): Promise<FiscalResult> {
    const { config } = params
    assertNfceConfig(config)

    const traceId = params.referenceId
    const dataEmissao = new Date()
    const env = config.environment

    log('info', 'Iniciando emissão NFC-e via SEFAZ', { traceId, uf: config.uf, cnpj: config.cnpj, environment: env })

    const certData = loadCertificateOrThrow(config, traceId)

    const chave = buildChaveAcesso({
      uf: config.uf,
      dataEmissao,
      cnpj: config.cnpj,
      serie: config.serie,
      numeroNf: config.numeroNf,
    })
    log('info', 'Chave de acesso gerada', { traceId, chaveAcesso: chave.chave })

    const nfceXml = buildNfceXml({ params, config, chave, dataEmissao })
    log('info', 'XML NFC-e gerado', { traceId })

    const signedResult = signXmlOrThrow(nfceXml, certData, traceId)

    const urls = getSefazUrls(config.uf, env)
    const cUF = UF_IBGE_CODES[config.uf] ?? '00'

    log('info', 'Enviando NFC-e para SEFAZ', {
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
          signedNfeXml: signedResult.signedXml,
          loteId: chave.cNF,
          wsdlNamespace: urls.wsdlNamespace,
          certData,
        })
      },
      {
        operationName: 'SEFAZ NFC-e autorizacao',
        logger: { warn: (message, meta) => log('warn', message, meta ?? {}) },
      }
    )

    if (result.success) {
      log('info', 'NFC-e autorizada com sucesso pela SEFAZ', {
        traceId,
        chaveAcesso: result.chaveAcesso,
        protocolo: result.protocolo,
      })
    } else {
      log('error', 'NFC-e rejeitada pela SEFAZ', {
        traceId,
        errorCode: result.errorCode,
        errorMessage: result.errorMessage,
      })
    }

    return {
      ...result,
      chaveAcesso: result.chaveAcesso ?? chave.chave,
      serie: config.serie,
      numeroDocumento: config.numeroNf,
    }
  }

  async cancel(params: CancelFiscalParams): Promise<FiscalResult> {
    const { config } = params
    assertNfceConfig(config)

    const traceId = params.chaveAcesso

    log('info', 'Iniciando cancelamento NFC-e via SEFAZ', { traceId, chaveAcesso: params.chaveAcesso })

    const certData = loadCertificateOrThrow(config, traceId)
    const urls = getSefazUrls(config.uf, config.environment)
    const cUF = UF_IBGE_CODES[config.uf] ?? '00'
    const dhEvento = formatSefazDateTime(new Date())

    const result = await withRetry(
      (attempt) => {
        if (attempt > 1) {
          log('warn', `Retentativa ${attempt} de cancelamento no SEFAZ`, { traceId, attempt })
        }
        return sendNfceCancelamento({
          endpoint: urls.recepcaoEvento,
          cUF,
          chaveAcesso: params.chaveAcesso,
          justificativa: params.justificativa,
          cnpj: config.cnpj,
          dhEvento,
          nSeqEvento: '1',
          certData,
        })
      },
      {
        operationName: 'SEFAZ cancelamento NFC-e',
        logger: { warn: (message, meta) => log('warn', message, meta ?? {}) },
      }
    )

    if (result.success) {
      log('info', 'NFC-e cancelada com sucesso', { traceId, protocolo: result.protocolo })
    } else {
      log('error', 'Cancelamento rejeitado pela SEFAZ', {
        traceId,
        errorCode: result.errorCode,
        errorMessage: result.errorMessage,
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

    log('info', 'Verificando status do serviço SEFAZ', { uf: config.uf, environment: config.environment })

    const status = await sendStatusServico({ endpoint: urls.statusServico, cUF, certData })

    log(status.ok ? 'info' : 'warn', 'Status SEFAZ obtido', {
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
  try {
    const certData = loadCertificate(config.certificadoBase64, config.certificadoSenha)
    log('info', 'Certificado A1 carregado com sucesso', { traceId })
    return certData
  } catch (error) {
    log('error', 'Falha ao carregar certificado A1', {
      traceId,
      error: error instanceof Error ? error.message : String(error),
    })
    throw error
  }
}

function signXmlOrThrow(xml: string, certData: CertificateData, traceId: string) {
  try {
    const result = signNfceXml(xml, certData)
    log('info', 'XML NFC-e assinado digitalmente', { traceId })
    return result
  } catch (error) {
    log('error', 'Falha ao assinar XML da NFC-e', {
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
