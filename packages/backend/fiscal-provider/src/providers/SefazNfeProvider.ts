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
import { loadCertificate, signNfceXml, type CertificateData } from '../sefaz/SefazXmlSigner'
import { getNfeUrls } from '../sefaz/NfeConstants'
import { UF_IBGE_CODES } from '../sefaz/SefazConstants'
import {
  sendNfeAutorizacao,
  sendNfeCancelamento,
  sendNfeStatusServico,
} from '../sefaz/SefazSoapClient'
import { withRetry } from '../sefaz/SefazRetry'
import { FiscalError } from '../errors/FiscalError'

const APP_NAME = 'fiscal-provider:sefaz-nfe'

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

    if (!params.nfeData) {
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

    log('info', 'Iniciando emissão NF-e via SEFAZ', { traceId, uf: config.uf, cnpj: config.cnpj, environment: env })

    const certData = loadCertificateOrThrow(config, traceId)

    const chave = buildChaveAcesso({
      uf: config.uf,
      dataEmissao,
      cnpj: config.cnpj,
      serie: config.serie,
      numeroNf: config.numeroNf,
      mod: '55',
    })
    log('info', 'Chave de acesso NF-e gerada', { traceId, chaveAcesso: chave.chave })

    const nfeXml = buildNfeXml({ params, config, nfeData: params.nfeData, chave, dataEmissao })
    log('info', 'XML NF-e gerado', { traceId })

    const signedResult = signXmlOrThrow(nfeXml, certData, traceId)

    const urls = getNfeUrls(config.uf, env)
    const cUF = UF_IBGE_CODES[config.uf] ?? '00'

    log('info', 'Enviando NF-e para SEFAZ', { traceId, endpoint: urls.autorizacao, environment: env, uf: config.uf })

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

    const finalResult: FiscalResult = {
      ...result,
      chaveAcesso: result.chaveAcesso ?? chave.chave,
      serie: config.serie,
      numeroDocumento: config.numeroNf,
    }

    if (finalResult.success) {
      log('info', 'NF-e autorizada com sucesso pela SEFAZ', {
        traceId,
        chaveAcesso: finalResult.chaveAcesso,
        protocolo: finalResult.protocolo,
      })
    } else {
      log('error', 'NF-e rejeitada pela SEFAZ', {
        traceId,
        errorCode: finalResult.errorCode,
        errorMessage: finalResult.errorMessage,
      })
    }

    return finalResult
  }

  async cancel(params: CancelFiscalParams): Promise<FiscalResult> {
    const { config } = params
    assertNfeConfig(config)

    if (!params.chaveAcesso || params.chaveAcesso.replace(/\D/g, '').length !== 44) {
      return {
        success: false,
        errorCode: 'INVALID_CHAVE',
        errorMessage: `chaveAcesso inválida: deve ter exatamente 44 dígitos numéricos (recebido: "${params.chaveAcesso}")`,
        rawResponse: null,
      }
    }

    if (!params.protocolo || params.protocolo.trim() === '') {
      return {
        success: false,
        errorCode: 'MISSING_PROTOCOLO',
        errorMessage: 'protocolo é obrigatório para cancelamento de NF-e',
        rawResponse: null,
      }
    }

    if (!params.justificativa || params.justificativa.trim().length < 15) {
      return {
        success: false,
        errorCode: 'INVALID_JUSTIFICATIVA',
        errorMessage: `justificativa muito curta: SEFAZ exige mínimo 15 caracteres (recebido: ${params.justificativa?.trim().length ?? 0})`,
        rawResponse: null,
      }
    }

    const traceId = params.chaveAcesso
    const protocolo = params.protocolo as string

    log('info', 'Iniciando cancelamento NF-e via SEFAZ', { traceId, chaveAcesso: params.chaveAcesso })

    const certData = loadCertificateOrThrow(config, traceId)
    const urls = getNfeUrls(config.uf, config.environment)
    const cUF = UF_IBGE_CODES[config.uf] ?? '00'
    const dhEvento = formatSefazDateTime(new Date())
    const tpAmb = config.environment === 'producao' ? '1' : '2'

    const result = await withRetry(
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

    if (result.success) {
      log('info', 'NF-e cancelada com sucesso', { traceId, protocolo: result.protocolo })
    } else {
      log('error', 'Cancelamento NF-e rejeitado pela SEFAZ', {
        traceId,
        errorCode: result.errorCode,
        errorMessage: result.errorMessage,
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

    log('info', 'Verificando status do serviço SEFAZ NF-e', { uf: config.uf, environment: config.environment })

    const status = await sendNfeStatusServico({ endpoint: urls.statusServico, cUF, certData })

    log(status.ok ? 'info' : 'warn', 'Status SEFAZ NF-e obtido', {
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
    log('info', 'XML NF-e assinado digitalmente', { traceId })
    return result
  } catch (error) {
    log('error', 'Falha ao assinar XML da NF-e', {
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
