import type { FiscalResult, NfceConfig, NfeConfig } from '../types'
import { loadCertificate } from './SefazXmlSigner'
import { getSefazUrls, UF_IBGE_CODES } from './SefazConstants'
import { getNfeUrls } from './NfeConstants'
import { formatSefazDateTime } from './SefazDateTime'
import { cancelEventoDate } from './SefazCancelTiming'
import { sendConsultaProtocolo, sendCartaCorrecao, sendInutilizacao, type ConsultaResult } from './SefazSoapClient'

type DocConfig = NfceConfig | NfeConfig

type Resolved = {
  cert: ReturnType<typeof loadCertificate>
  cUF: string
  tpAmb: string
  mod: string
  autorizacao: string
  consultaProtocolo: string
  recepcaoEvento: string
}

function resolve(config: DocConfig): Resolved {
  const urls =
    config.model === 'nfe' ? getNfeUrls(config.uf, config.environment) : getSefazUrls(config.uf, config.environment)
  return {
    cert: loadCertificate(config.certificadoBase64, config.certificadoSenha),
    cUF: UF_IBGE_CODES[config.uf] ?? '00',
    tpAmb: config.environment === 'producao' ? '1' : '2',
    mod: config.model === 'nfe' ? '55' : '65',
    autorizacao: urls.autorizacao,
    consultaProtocolo: urls.consultaProtocolo,
    recepcaoEvento: urls.recepcaoEvento,
  }
}

/** Consulta a situação de uma NF-e/NFC-e pela chave (autorizada/cancelada + protocolo). */
export async function consultarNfe(params: { chaveAcesso: string; config: DocConfig }): Promise<ConsultaResult> {
  const r = resolve(params.config)
  return sendConsultaProtocolo({
    endpoint: r.consultaProtocolo,
    cUF: r.cUF,
    chaveAcesso: params.chaveAcesso.replace(/\D/g, ''),
    tpAmb: r.tpAmb,
    certData: r.cert,
  })
}

/** Carta de Correção Eletrônica (evento 110110) — corrige erro leve sem cancelar. */
export async function cartaCorrecao(params: {
  chaveAcesso: string
  correcao: string
  sequenciaEvento?: number
  config: DocConfig
}): Promise<FiscalResult> {
  const r = resolve(params.config)
  const correcao = params.correcao.trim()
  if (correcao.length < 15 || correcao.length > 1000) {
    return {
      success: false,
      errorCode: 'INVALID_CORRECAO',
      errorMessage: `Correção deve ter entre 15 e 1000 caracteres (recebido: ${correcao.length})`,
      rawResponse: null,
    }
  }
  return sendCartaCorrecao({
    endpoint: r.recepcaoEvento,
    cUF: r.cUF,
    chaveAcesso: params.chaveAcesso.replace(/\D/g, ''),
    correcao,
    cnpj: params.config.cnpj,
    dhEvento: formatSefazDateTime(cancelEventoDate()),
    nSeqEvento: String(params.sequenciaEvento ?? 1),
    tpAmb: r.tpAmb,
    certData: r.cert,
  })
}

/** Inutilização de faixa de numeração (nunca emitida). */
export async function inutilizar(params: {
  serie: string
  numeroInicial: number
  numeroFinal: number
  justificativa: string
  ano?: number
  config: DocConfig
}): Promise<FiscalResult> {
  const r = resolve(params.config)
  const just = params.justificativa.trim()
  if (just.length < 15 || just.length > 255) {
    return {
      success: false,
      errorCode: 'INVALID_JUSTIFICATIVA',
      errorMessage: `Justificativa deve ter entre 15 e 255 caracteres (recebido: ${just.length})`,
      rawResponse: null,
    }
  }
  // Endpoint de inutilização derivado do de autorização (não exposto em getSefazUrls)
  const endpoint = r.autorizacao.replace(/Autorizacao4/g, 'Inutilizacao4').replace(/Autorizacao\//g, 'Inutilizacao/')
  const ano = String((params.ano ?? new Date().getFullYear()) % 100).padStart(2, '0')
  return sendInutilizacao({
    endpoint,
    cUF: r.cUF,
    ano,
    cnpj: params.config.cnpj,
    mod: r.mod,
    serie: params.serie,
    numeroInicial: String(params.numeroInicial),
    numeroFinal: String(params.numeroFinal),
    justificativa: just,
    tpAmb: r.tpAmb,
    certData: r.cert,
  })
}
