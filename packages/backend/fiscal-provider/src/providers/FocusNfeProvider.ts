import type { FiscalProvider } from '../FiscalProvider.interface'
import type {
  EmitFiscalParams,
  CancelFiscalParams,
  TestConnectionParams,
  FiscalResult,
  TestConnectionResult,
  NfceConfig,
} from '../types'
import { buildNfcePayload } from '../utils/buildNfcePayload'
import { FiscalConnectionError, FiscalTimeoutError } from '../errors/FiscalError'

const FOCUS_NFE_BASE_URL = 'https://api.focusnfe.com.br'
const FOCUS_NFE_SANDBOX_URL = 'https://homologacao.focusnfe.com.br'
const REQUEST_TIMEOUT_MS = 15_000

type FocusNfeEmitResponse = {
  status: 'autorizado' | 'erro' | 'cancelado' | 'processando'
  chave_nfe?: string
  numero?: number
  serie?: string
  protocolo_autorizacao?: string
  caminho_xml_nota_fiscal?: string
  caminho_danfe?: string
  qrcode_url?: string
  erros?: Array<{ codigo: string; mensagem: string }>
  mensagem_sefaz?: string
  codigo_situacao?: string
}

type FocusNfeCancelResponse = {
  status: 'cancelado' | 'erro'
  protocolo_cancelamento?: string
  erros?: Array<{ codigo: string; mensagem: string }>
}

type FocusNfeEmpresaResponse = {
  cnpj: string
  nome: string
}

export class FocusNfeProvider implements FiscalProvider {
  private buildBaseUrl(config: NfceConfig): string {
    return config.environment === 'producao' ? FOCUS_NFE_BASE_URL : FOCUS_NFE_SANDBOX_URL
  }

  private buildAuthHeader(token: string): string {
    return `Basic ${Buffer.from(`${token}:`).toString('base64')}`
  }

  private async fetchWithTimeout(
    url: string,
    options: RequestInit
  ): Promise<Response> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

    try {
      return await fetch(url, { ...options, signal: controller.signal })
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new FiscalTimeoutError('Focus NFe')
      }
      throw new FiscalConnectionError(
        'Focus NFe',
        error instanceof Error ? error.message : 'unknown error'
      )
    } finally {
      clearTimeout(timer)
    }
  }

  async emit(params: EmitFiscalParams): Promise<FiscalResult> {
    const config = params.config as NfceConfig
    const baseUrl = this.buildBaseUrl(config)
    const payload = buildNfcePayload(params, config)

    const response = await this.fetchWithTimeout(
      `${baseUrl}/v2/nfce?ref=${params.referenceId}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: this.buildAuthHeader(config.focusNfeToken),
        },
        body: JSON.stringify(payload),
      }
    )

    const raw = await response.json() as FocusNfeEmitResponse

    if (raw.status === 'autorizado') {
      return {
        success: true,
        chaveAcesso: raw.chave_nfe,
        protocolo: raw.protocolo_autorizacao,
        numeroDocumento: raw.numero,
        serie: raw.serie,
        qrCodeUrl: raw.qrcode_url,
        danfePdfUrl: raw.caminho_danfe
          ? `${baseUrl}${raw.caminho_danfe}`
          : undefined,
        rawResponse: raw,
      }
    }

    const firstError = raw.erros?.[0]
    return {
      success: false,
      errorCode: raw.codigo_situacao ?? firstError?.codigo,
      errorMessage: raw.mensagem_sefaz ?? firstError?.mensagem ?? 'Erro desconhecido',
      rawResponse: raw,
    }
  }

  async cancel(params: CancelFiscalParams): Promise<FiscalResult> {
    const config = params.config as NfceConfig
    const baseUrl = this.buildBaseUrl(config)

    if (params.justificativa.trim().length < 15) {
      return {
        success: false,
        errorCode: 'INVALID_JUSTIFICATIVA',
        errorMessage: 'A justificativa deve ter no mínimo 15 caracteres',
        rawResponse: null,
      }
    }

    const response = await this.fetchWithTimeout(
      `${baseUrl}/v2/nfce/${params.chaveAcesso}`,
      {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: this.buildAuthHeader(config.focusNfeToken),
        },
        body: JSON.stringify({ justificativa: params.justificativa }),
      }
    )

    const raw = await response.json() as FocusNfeCancelResponse

    if (raw.status === 'cancelado') {
      return {
        success: true,
        protocolo: raw.protocolo_cancelamento,
        rawResponse: raw,
      }
    }

    const firstError = raw.erros?.[0]
    return {
      success: false,
      errorCode: firstError?.codigo,
      errorMessage: firstError?.mensagem ?? 'Erro ao cancelar',
      rawResponse: raw,
    }
  }

  async testConnection(params: TestConnectionParams): Promise<TestConnectionResult> {
    const config = params.config as NfceConfig
    const baseUrl = this.buildBaseUrl(config)

    try {
      const response = await this.fetchWithTimeout(
        `${baseUrl}/v2/empresas?cnpj=${config.cnpj.replace(/\D/g, '')}`,
        {
          method: 'GET',
          headers: {
            Authorization: this.buildAuthHeader(config.focusNfeToken),
          },
        }
      )

      if (response.status === 401) {
        return { ok: false, message: 'Token inválido — verifique o token do Focus NFe' }
      }

      if (response.status === 404) {
        return { ok: false, message: 'CNPJ não cadastrado no Focus NFe' }
      }

      if (!response.ok) {
        return { ok: false, message: `Focus NFe retornou status ${response.status}` }
      }

      const data = await response.json() as FocusNfeEmpresaResponse | FocusNfeEmpresaResponse[]
      const empresa = Array.isArray(data) ? data[0] : data

      return {
        ok: true,
        message: `Conectado — empresa: ${empresa?.nome ?? config.razaoSocial}`,
      }
    } catch (error) {
      if (error instanceof FiscalTimeoutError) {
        return { ok: false, message: 'Timeout — Focus NFe não respondeu em 15s' }
      }
      if (error instanceof FiscalConnectionError) {
        return { ok: false, message: `Erro de conexão: ${error.providerMessage}` }
      }
      return { ok: false, message: 'Erro inesperado ao testar conexão' }
    }
  }
}
