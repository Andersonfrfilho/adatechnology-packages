// Namespaces CT-e v4 — cada web service tem o seu próprio namespace
export const CTE_WS_NS = {
  status: 'http://www.portalfiscal.inf.br/cte/wsdl/CTeStatusServicoV4',
  sincrona: 'http://www.portalfiscal.inf.br/cte/wsdl/CTeRecepcaoSincV4',
  // CT-e 4.00 usa exclusivamente o fluxo síncrono (CTeRecepcaoSincV4)
  // Os serviços CTeRecepcao4 + CTeRetRecepcao4 eram do CT-e 3.00 e foram desativados
  autorizacao: 'http://www.portalfiscal.inf.br/cte/wsdl/CTeRecepcaoSincV4',
  retAutorizacao: 'http://www.portalfiscal.inf.br/cte/wsdl/CTeRetRecepcao4',
  evento: 'http://www.portalfiscal.inf.br/cte/wsdl/CTeRecepcaoEventoV4',
  consulta: 'http://www.portalfiscal.inf.br/cte/wsdl/CTeConsultaV4',
} as const

export type CteUrls = {
  readonly autorizacao: string
  readonly recepcaoEvento: string
  readonly consultaProtocolo: string
  readonly statusServico: string
  /**
   * CT-e 4.00: todos os estados usam fluxo síncrono (CTeRecepcaoSincV4).
   * O fluxo assíncrono (CTeRecepcao4 + CTeRetRecepcao4) era do CT-e 3.00.
   */
  readonly modoAutorizacao: 'sincrono' | 'assincrono'
}

// SVRS homologação — cobre todos os estados sem servidor próprio:
// AC, AL, AM, AP, CE, DF, ES, GO, MA, PB, PE, PI, RJ, RN, RO, RR, SC, SE, TO
// (SP, RS, MG, PR, MS, MT agora têm servidores próprios com endpoint correto)
const SVRS_CTE: Record<'homologacao' | 'producao', CteUrls> = {
  homologacao: {
    autorizacao: 'https://cte-homologacao.svrs.rs.gov.br/ws/CTeRecepcaoSincV4/CTeRecepcaoSincV4.asmx',
    recepcaoEvento: 'https://cte-homologacao.svrs.rs.gov.br/ws/CTeRecepcaoEventoV4/CTeRecepcaoEventoV4.asmx',
    consultaProtocolo: 'https://cte-homologacao.svrs.rs.gov.br/ws/CTeConsultaV4/CTeConsultaV4.asmx',
    statusServico: 'https://cte-homologacao.svrs.rs.gov.br/ws/CTeStatusServicoV4/CTeStatusServicoV4.asmx',
    modoAutorizacao: 'sincrono',
  },
  producao: {
    autorizacao: 'https://cte.svrs.rs.gov.br/ws/CTeRecepcaoSincV4/CTeRecepcaoSincV4.asmx',
    recepcaoEvento: 'https://cte.svrs.rs.gov.br/ws/CTeRecepcaoEventoV4/CTeRecepcaoEventoV4.asmx',
    consultaProtocolo: 'https://cte.svrs.rs.gov.br/ws/CTeConsultaV4/CTeConsultaV4.asmx',
    statusServico: 'https://cte.svrs.rs.gov.br/ws/CTeStatusServicoV4/CTeStatusServicoV4.asmx',
    modoAutorizacao: 'sincrono',
  },
}

// Estados com servidor CT-e próprio — fonte: dfe-portal.svrs.rs.gov.br/Cte/Servicos (2026-06)
const STATE_CTE_ENDPOINTS: Record<string, Record<'homologacao' | 'producao', CteUrls>> = {
  // São Paulo — servidor próprio via nfe.fazenda.sp.gov.br/CTeWS
  SP: {
    homologacao: {
      autorizacao: 'https://homologacao.nfe.fazenda.sp.gov.br/CTeWS/WS/CTeRecepcaoSincV4.asmx',
      recepcaoEvento: 'https://homologacao.nfe.fazenda.sp.gov.br/CTeWS/WS/CTeRecepcaoEventoV4.asmx',
      consultaProtocolo: 'https://homologacao.nfe.fazenda.sp.gov.br/CTeWS/WS/CTeConsultaV4.asmx',
      statusServico: 'https://homologacao.nfe.fazenda.sp.gov.br/CTeWS/WS/CTeStatusServicoV4.asmx',
      modoAutorizacao: 'sincrono',
    },
    producao: {
      autorizacao: 'https://nfe.fazenda.sp.gov.br/CTeWS/WS/CTeRecepcaoSincV4.asmx',
      recepcaoEvento: 'https://nfe.fazenda.sp.gov.br/CTeWS/WS/CTeRecepcaoEventoV4.asmx',
      consultaProtocolo: 'https://nfe.fazenda.sp.gov.br/CTeWS/WS/CTeConsultaV4.asmx',
      statusServico: 'https://nfe.fazenda.sp.gov.br/CTeWS/WS/CTeStatusServicoV4.asmx',
      modoAutorizacao: 'sincrono',
    },
  },
  // Minas Gerais — servidor Axis2 (sem .asmx)
  MG: {
    homologacao: {
      autorizacao: 'https://hcte.fazenda.mg.gov.br/cte/services/CTeRecepcaoSincV4',
      recepcaoEvento: 'https://hcte.fazenda.mg.gov.br/cte/services/CTeRecepcaoEventoV4',
      consultaProtocolo: 'https://hcte.fazenda.mg.gov.br/cte/services/CTeConsultaV4',
      statusServico: 'https://hcte.fazenda.mg.gov.br/cte/services/CTeStatusServicoV4',
      modoAutorizacao: 'sincrono',
    },
    producao: {
      autorizacao: 'https://cte.fazenda.mg.gov.br/cte/services/CTeRecepcaoSincV4',
      recepcaoEvento: 'https://cte.fazenda.mg.gov.br/cte/services/CTeRecepcaoEventoV4',
      consultaProtocolo: 'https://cte.fazenda.mg.gov.br/cte/services/CTeConsultaV4',
      statusServico: 'https://cte.fazenda.mg.gov.br/cte/services/CTeStatusServicoV4',
      modoAutorizacao: 'sincrono',
    },
  },
  // Paraná — servidor próprio via cte4/
  PR: {
    homologacao: {
      autorizacao: 'https://homologacao.cte.fazenda.pr.gov.br/cte4/CTeRecepcaoSincV4',
      recepcaoEvento: 'https://homologacao.cte.fazenda.pr.gov.br/cte4/CTeRecepcaoEventoV4',
      consultaProtocolo: 'https://homologacao.cte.fazenda.pr.gov.br/cte4/CTeConsultaV4',
      statusServico: 'https://homologacao.cte.fazenda.pr.gov.br/cte4/CTeStatusServicoV4',
      modoAutorizacao: 'sincrono',
    },
    producao: {
      autorizacao: 'https://cte.fazenda.pr.gov.br/cte4/CTeRecepcaoSincV4',
      recepcaoEvento: 'https://cte.fazenda.pr.gov.br/cte4/CTeRecepcaoEventoV4',
      consultaProtocolo: 'https://cte.fazenda.pr.gov.br/cte4/CTeConsultaV4',
      statusServico: 'https://cte.fazenda.pr.gov.br/cte4/CTeStatusServicoV4',
      modoAutorizacao: 'sincrono',
    },
  },
  // Mato Grosso do Sul — servidor próprio
  MS: {
    homologacao: {
      autorizacao: 'https://homologacao.cte.ms.gov.br/ws/CTeRecepcaoSincV4',
      recepcaoEvento: 'https://homologacao.cte.ms.gov.br/ws/CTeRecepcaoEventoV4',
      consultaProtocolo: 'https://homologacao.cte.ms.gov.br/ws/CTeConsultaV4',
      statusServico: 'https://homologacao.cte.ms.gov.br/ws/CTeStatusServicoV4',
      modoAutorizacao: 'sincrono',
    },
    producao: {
      autorizacao: 'https://producao.cte.ms.gov.br/ws/CTeRecepcaoSincV4',
      recepcaoEvento: 'https://producao.cte.ms.gov.br/ws/CTeRecepcaoEventoV4',
      consultaProtocolo: 'https://producao.cte.ms.gov.br/ws/CTeConsultaV4',
      statusServico: 'https://producao.cte.ms.gov.br/ws/CTeStatusServicoV4',
      modoAutorizacao: 'sincrono',
    },
  },
  // Mato Grosso — servidor próprio via ctews2
  MT: {
    homologacao: {
      autorizacao: 'https://homologacao.sefaz.mt.gov.br/ctews2/services/CTeRecepcaoSincV4',
      recepcaoEvento: 'https://homologacao.sefaz.mt.gov.br/ctews2/services/CTeRecepcaoEventoV4',
      consultaProtocolo: 'https://homologacao.sefaz.mt.gov.br/ctews2/services/CTeConsultaV4',
      statusServico: 'https://homologacao.sefaz.mt.gov.br/ctews2/services/CTeStatusServicoV4',
      modoAutorizacao: 'sincrono',
    },
    producao: {
      autorizacao: 'https://cte.sefaz.mt.gov.br/ctews2/services/CTeRecepcaoSincV4',
      recepcaoEvento: 'https://cte.sefaz.mt.gov.br/ctews2/services/CTeRecepcaoEventoV4',
      consultaProtocolo: 'https://cte.sefaz.mt.gov.br/ctews2/services/CTeConsultaV4',
      statusServico: 'https://cte.sefaz.mt.gov.br/ctews2/services/CTeStatusServicoV4',
      modoAutorizacao: 'sincrono',
    },
  },
  // Rio Grande do Sul — usa SVRS (mesmo host) com as mesmas URLs do fallback
  RS: {
    homologacao: SVRS_CTE.homologacao,
    producao: SVRS_CTE.producao,
  },
  // Bahia — portal sugere SVRS; manter como alias até confirmar URL própria
}

export const UF_IBGE_CODES_CTE: Record<string, string> = {
  AC: '12',
  AL: '27',
  AM: '13',
  AP: '16',
  BA: '29',
  CE: '23',
  DF: '53',
  ES: '32',
  GO: '52',
  MA: '21',
  MG: '31',
  MS: '50',
  MT: '51',
  PA: '15',
  PB: '25',
  PE: '26',
  PI: '22',
  PR: '41',
  RJ: '33',
  RN: '24',
  RO: '11',
  RR: '14',
  RS: '43',
  SC: '42',
  SE: '28',
  SP: '35',
  TO: '17',
}

export const NFE_DISTRIBUICAO_ENDPOINT = {
  homologacao: 'https://hom1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx',
  producao: 'https://www1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx',
} as const

export function getCteUrls(uf: string, environment: 'homologacao' | 'producao'): CteUrls {
  const mockBase = process.env['MOCK_SEFAZ_URL']
  if (mockBase) {
    return {
      autorizacao: `${mockBase}/ws/CTeRecepcaoSincV4`,
      recepcaoEvento: `${mockBase}/ws/CTeRecepcaoEventoV4`,
      consultaProtocolo: `${mockBase}/ws/CTeConsultaV4`,
      statusServico: `${mockBase}/ws/CTeStatusServicoV4`,
      modoAutorizacao: 'sincrono',
    }
  }
  return STATE_CTE_ENDPOINTS[uf]?.[environment] ?? SVRS_CTE[environment]
}
