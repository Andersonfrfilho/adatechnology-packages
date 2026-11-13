export const MDFE_NS = 'http://www.portalfiscal.inf.br/mdfe'
export const MDFE_VERSAO = '3.00'
export const MDFE_MODELO = '58'

const MDFE_WSDL_BASE = `${MDFE_NS}/wsdl`

// Namespaces MDF-e 3.00 — um por web service, no padrão <portal>/wsdl/<operation>
export const MDFE_WS_NS = {
  // A recepção assíncrona (MDFeRecepcao + MDFeRetRecepcao) foi desativada em 2024-06-30
  recepcaoSinc: `${MDFE_WSDL_BASE}/MDFeRecepcaoSinc`,
  recepcaoEvento: `${MDFE_WSDL_BASE}/MDFeRecepcaoEvento`,
  consulta: `${MDFE_WSDL_BASE}/MDFeConsulta`,
  status: `${MDFE_WSDL_BASE}/MDFeStatusServico`,
  consultaNaoEncerrados: `${MDFE_WSDL_BASE}/MDFeConsNaoEnc`,
} as const

export const MDFE_SOAP_METHOD = {
  recepcaoSinc: 'mdfeRecepcao',
  recepcaoEvento: 'mdfeRecepcaoEvento',
  consulta: 'mdfeConsultaMDF',
  status: 'mdfeStatusServicoMDF',
  consultaNaoEncerrados: 'mdfeConsNaoEnc',
} as const

export type MdfeUrls = {
  readonly autorizacao: string
  readonly recepcaoEvento: string
  readonly consultaProtocolo: string
  readonly statusServico: string
  readonly consultaNaoEncerrados: string
}

// A SVRS é o autorizador nacional único do MDF-e — nenhuma UF opera servidor próprio
const SVRS_MDFE: Record<'homologacao' | 'producao', MdfeUrls> = {
  homologacao: {
    autorizacao: 'https://mdfe-homologacao.svrs.rs.gov.br/ws/MDFeRecepcaoSinc/MDFeRecepcaoSinc.asmx',
    recepcaoEvento: 'https://mdfe-homologacao.svrs.rs.gov.br/ws/MDFeRecepcaoEvento/MDFeRecepcaoEvento.asmx',
    consultaProtocolo: 'https://mdfe-homologacao.svrs.rs.gov.br/ws/MDFeConsulta/MDFeConsulta.asmx',
    statusServico: 'https://mdfe-homologacao.svrs.rs.gov.br/ws/MDFeStatusServico/MDFeStatusServico.asmx',
    consultaNaoEncerrados: 'https://mdfe-homologacao.svrs.rs.gov.br/ws/MDFeConsNaoEnc/MDFeConsNaoEnc.asmx',
  },
  producao: {
    autorizacao: 'https://mdfe.svrs.rs.gov.br/ws/MDFeRecepcaoSinc/MDFeRecepcaoSinc.asmx',
    recepcaoEvento: 'https://mdfe.svrs.rs.gov.br/ws/MDFeRecepcaoEvento/MDFeRecepcaoEvento.asmx',
    consultaProtocolo: 'https://mdfe.svrs.rs.gov.br/ws/MDFeConsulta/MDFeConsulta.asmx',
    statusServico: 'https://mdfe.svrs.rs.gov.br/ws/MDFeStatusServico/MDFeStatusServico.asmx',
    consultaNaoEncerrados: 'https://mdfe.svrs.rs.gov.br/ws/MDFeConsNaoEnc/MDFeConsNaoEnc.asmx',
  },
}

const SVRS_MDFE_QR_CODE_URL = 'https://dfe-portal.svrs.rs.gov.br/mdfe/qrCode'

export function getMdfeQrCodeUrl(): string {
  return SVRS_MDFE_QR_CODE_URL
}

/** A UF do emitente não altera o endpoint — o roteamento do MDF-e é nacional. */
export function getMdfeUrls(environment: 'homologacao' | 'producao'): MdfeUrls {
  const mockBase = process.env['MOCK_SEFAZ_URL']
  if (mockBase) {
    return {
      autorizacao: `${mockBase}/ws/MDFeRecepcaoSinc`,
      recepcaoEvento: `${mockBase}/ws/MDFeRecepcaoEvento`,
      consultaProtocolo: `${mockBase}/ws/MDFeConsulta`,
      statusServico: `${mockBase}/ws/MDFeStatusServico`,
      consultaNaoEncerrados: `${mockBase}/ws/MDFeConsNaoEnc`,
    }
  }
  return SVRS_MDFE[environment]
}
