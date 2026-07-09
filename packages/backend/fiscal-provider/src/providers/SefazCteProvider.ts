import type { FiscalProvider } from '../FiscalProvider.interface'
import type {
  EmitFiscalParams,
  CancelFiscalParams,
  TestConnectionParams,
  FiscalResult,
  TestConnectionResult,
  CteConfig,
  CteData,
} from '../types'
import { FiscalError, FiscalRejectionError } from '../errors/FiscalError'
import { loadCertificate } from '../sefaz/SefazXmlSigner'
import { signCteXml } from '../sefaz/SefazXmlSigner'
import { buildCteXml } from '../sefaz/CteXmlBuilder'
import { getCteUrls, UF_IBGE_CODES_CTE } from '../sefaz/CteConstants'
import {
  sendCteAutorizacao,
  sendCteStatusServico,
  sendCteCancelamento,
} from '../sefaz/CteSoapClient'

function log(level: 'info' | 'warn' | 'error', message: string, meta: Record<string, unknown> = {}): void {
  const entry = {
    timestamp: new Date().toISOString(),
    app: 'fiscal-provider:sefaz-cte',
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

function formatDhEvento(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}-03:00`
}

export class SefazCteProvider implements FiscalProvider {
  async emit(params: EmitFiscalParams): Promise<FiscalResult> {
    const config = params.config as CteConfig
    const cteData = params.cteData

    if (!cteData) {
      return {
        success: false,
        errorCode: 'MISSING_CTE_DATA',
        errorMessage: 'cteData é obrigatório para emitir CT-e',
        rawResponse: null,
      }
    }

    const traceId = params.referenceId
    log('info', 'Iniciando emissão CT-e via SEFAZ', { traceId })

    let certData: ReturnType<typeof loadCertificate>
    try {
      certData = loadCertificate(config.certificadoBase64, config.certificadoSenha)
      log('info', 'Certificado A1 carregado', { traceId, fromCache: false })
    } catch (error) {
      throw new FiscalError(
        `Falha ao carregar certificado: ${error instanceof Error ? error.message : 'desconhecido'}`,
        'CERT_LOAD_ERROR',
        traceId,
        null,
      )
    }

    const { xml: unsignedXml, chaveAcesso } = buildCteXml(config, cteData)
    const { signedXml } = signCteXml(unsignedXml, certData)

    const urls = getCteUrls(config.uf, config.environment)
    const cUF = UF_IBGE_CODES_CTE[config.uf] ?? '35'
    const tpAmb = config.environment === 'producao' ? '1' : '2'

    log('info', 'Transmitindo CT-e', { traceId, chaveAcesso: `${chaveAcesso.slice(0, 6)}...${chaveAcesso.slice(-4)}` })

    const result = await sendCteAutorizacao({
      endpoint: urls.autorizacao,
      cUF,
      signedCteXml: signedXml,
      loteId: String(config.numeroCte),
      wsdlNamespace: urls.wsdlNamespace,
      certData,
    })

    if (result.success) {
      log('info', 'CT-e autorizado com sucesso', { traceId, chaveAcesso: result.chaveAcesso, protocolo: result.protocolo })
    } else {
      log('error', 'CT-e rejeitado pela SEFAZ', { traceId, errorCode: result.errorCode, errorMessage: result.errorMessage })
    }

    return result
  }

  async cancel(params: CancelFiscalParams): Promise<FiscalResult> {
    const config = params.config as CteConfig

    if (!params.protocolo) {
      return {
        success: false,
        errorCode: 'MISSING_PROTOCOLO',
        errorMessage: 'protocolo é obrigatório para cancelamento de CT-e',
        rawResponse: null,
      }
    }

    if (!params.justificativa || params.justificativa.trim().length < 15) {
      return {
        success: false,
        errorCode: 'INVALID_JUSTIFICATIVA',
        errorMessage: `justificativa muito curta: mínimo 15 caracteres (recebido: ${params.justificativa?.trim().length ?? 0})`,
        rawResponse: null,
      }
    }

    const traceId = params.chaveAcesso
    log('info', 'Iniciando cancelamento CT-e', { traceId })

    const certData = loadCertificate(config.certificadoBase64, config.certificadoSenha)
    const urls = getCteUrls(config.uf, config.environment)
    const cUF = UF_IBGE_CODES_CTE[config.uf] ?? '35'
    const tpAmb = config.environment === 'producao' ? '1' : '2'

    const result = await sendCteCancelamento({
      endpoint: urls.recepcaoEvento,
      cUF,
      chaveAcesso: params.chaveAcesso,
      protocolo: params.protocolo,
      justificativa: params.justificativa,
      cnpj: config.cnpj,
      dhEvento: formatDhEvento(new Date()),
      wsdlNamespace: urls.wsdlNamespace,
      tpAmb,
      certData,
    })

    if (result.success) {
      log('info', 'CT-e cancelado com sucesso', { traceId, protocolo: result.protocolo })
    } else {
      log('error', 'Cancelamento CT-e rejeitado', { traceId, errorCode: result.errorCode })
    }

    return result
  }

  async testConnection(params: TestConnectionParams): Promise<TestConnectionResult> {
    const config = params.config as CteConfig

    try {
      const certData = loadCertificate(config.certificadoBase64, config.certificadoSenha)
      const urls = getCteUrls(config.uf, config.environment)
      const cUF = UF_IBGE_CODES_CTE[config.uf] ?? '35'
      const tpAmb = config.environment === 'producao' ? '1' : '2'

      const result = await sendCteStatusServico({
        endpoint: urls.statusServico,
        cUF,
        wsdlNamespace: urls.wsdlNamespace,
        tpAmb,
        certData,
      })

      return result
    } catch (error) {
      return {
        ok: false,
        message: `Falha ao conectar SEFAZ CT-e: ${error instanceof Error ? error.message : 'desconhecido'}`,
      }
    }
  }
}
