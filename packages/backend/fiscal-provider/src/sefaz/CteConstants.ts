type CteUrls = {
  readonly autorizacao: string
  readonly retAutorizacao: string
  readonly recepcaoEvento: string
  readonly consultaProtocolo: string
  readonly statusServico: string
  readonly wsdlNamespace: string
}

// SVRS — fallback para estados sem servidor CT-e próprio
// Cobre: AC, AL, AP, CE, DF, ES, GO, MA, MS, MT, PA, PB, PE, PI, RJ, RN, RO, RR, SC, SE, TO
const SVRS_CTE: Record<'homologacao' | 'producao', CteUrls> = {
  homologacao: {
    autorizacao:       'https://cte-homologacao.svrs.rs.gov.br/ws/cterecepcao/CTeRecepcao4.asmx',
    retAutorizacao:    'https://cte-homologacao.svrs.rs.gov.br/ws/cteretrecepcao/CTeRetRecepcao4.asmx',
    recepcaoEvento:    'https://cte-homologacao.svrs.rs.gov.br/ws/cterecepcaoevento/CTeRecepcaoEvento4.asmx',
    consultaProtocolo: 'https://cte-homologacao.svrs.rs.gov.br/ws/cteconsultaprotocolo/CTeConsultaProtocolo4.asmx',
    statusServico:     'https://cte-homologacao.svrs.rs.gov.br/ws/ctestatusservico/CTeStatusServico4.asmx',
    wsdlNamespace:     'http://www.portalfiscal.inf.br/cte/wsdl/CTeRecepcao4',
  },
  producao: {
    autorizacao:       'https://cte.svrs.rs.gov.br/ws/cterecepcao/CTeRecepcao4.asmx',
    retAutorizacao:    'https://cte.svrs.rs.gov.br/ws/cteretrecepcao/CTeRetRecepcao4.asmx',
    recepcaoEvento:    'https://cte.svrs.rs.gov.br/ws/cterecepcaoevento/CTeRecepcaoEvento4.asmx',
    consultaProtocolo: 'https://cte.svrs.rs.gov.br/ws/cteconsultaprotocolo/CTeConsultaProtocolo4.asmx',
    statusServico:     'https://cte.svrs.rs.gov.br/ws/ctestatusservico/CTeStatusServico4.asmx',
    wsdlNamespace:     'http://www.portalfiscal.inf.br/cte/wsdl/CTeRecepcao4',
  },
}

const STATE_CTE_ENDPOINTS: Record<string, Record<'homologacao' | 'producao', CteUrls>> = {
  SP: {
    homologacao: {
      autorizacao:       'https://homologacao.cte.fazenda.sp.gov.br/ws/CTeAutorizacao4.asmx',
      retAutorizacao:    'https://homologacao.cte.fazenda.sp.gov.br/ws/CTeRetAutorizacao4.asmx',
      recepcaoEvento:    'https://homologacao.cte.fazenda.sp.gov.br/ws/CTeRecepcaoEvento.asmx',
      consultaProtocolo: 'https://homologacao.cte.fazenda.sp.gov.br/ws/CTeConsultaProtocolo4.asmx',
      statusServico:     'https://homologacao.cte.fazenda.sp.gov.br/ws/CTeStatusServico4.asmx',
      wsdlNamespace:     'http://www.portalfiscal.inf.br/cte/wsdl/CTeRecepcao4',
    },
    producao: {
      autorizacao:       'https://cte.fazenda.sp.gov.br/ws/CTeAutorizacao4.asmx',
      retAutorizacao:    'https://cte.fazenda.sp.gov.br/ws/CTeRetAutorizacao4.asmx',
      recepcaoEvento:    'https://cte.fazenda.sp.gov.br/ws/CTeRecepcaoEvento.asmx',
      consultaProtocolo: 'https://cte.fazenda.sp.gov.br/ws/CTeConsultaProtocolo4.asmx',
      statusServico:     'https://cte.fazenda.sp.gov.br/ws/CTeStatusServico4.asmx',
      wsdlNamespace:     'http://www.portalfiscal.inf.br/cte/wsdl/CTeRecepcao4',
    },
  },
  MG: {
    homologacao: {
      autorizacao:       'https://hcte.fazenda.mg.gov.br/cte/services/CTeAutorizacao4',
      retAutorizacao:    'https://hcte.fazenda.mg.gov.br/cte/services/CTeRetAutorizacao4',
      recepcaoEvento:    'https://hcte.fazenda.mg.gov.br/cte/services/CTeRecepcaoEvento4',
      consultaProtocolo: 'https://hcte.fazenda.mg.gov.br/cte/services/CTeConsultaProtocolo4',
      statusServico:     'https://hcte.fazenda.mg.gov.br/cte/services/CTeStatusServico4',
      wsdlNamespace:     'http://www.portalfiscal.inf.br/cte/wsdl/CTeRecepcao4',
    },
    producao: {
      autorizacao:       'https://cte.fazenda.mg.gov.br/cte/services/CTeAutorizacao4',
      retAutorizacao:    'https://cte.fazenda.mg.gov.br/cte/services/CTeRetAutorizacao4',
      recepcaoEvento:    'https://cte.fazenda.mg.gov.br/cte/services/CTeRecepcaoEvento4',
      consultaProtocolo: 'https://cte.fazenda.mg.gov.br/cte/services/CTeConsultaProtocolo4',
      statusServico:     'https://cte.fazenda.mg.gov.br/cte/services/CTeStatusServico4',
      wsdlNamespace:     'http://www.portalfiscal.inf.br/cte/wsdl/CTeRecepcao4',
    },
  },
  PR: {
    homologacao: {
      autorizacao:       'https://homologacao.cte.fazenda.pr.gov.br/cte/services/CTeAutorizacao4',
      retAutorizacao:    'https://homologacao.cte.fazenda.pr.gov.br/cte/services/CTeRetAutorizacao4',
      recepcaoEvento:    'https://homologacao.cte.fazenda.pr.gov.br/cte/services/CTeRecepcaoEvento4',
      consultaProtocolo: 'https://homologacao.cte.fazenda.pr.gov.br/cte/services/CTeConsultaProtocolo4',
      statusServico:     'https://homologacao.cte.fazenda.pr.gov.br/cte/services/CTeStatusServico4',
      wsdlNamespace:     'http://www.portalfiscal.inf.br/cte/wsdl/CTeRecepcao4',
    },
    producao: {
      autorizacao:       'https://cte.fazenda.pr.gov.br/cte/services/CTeAutorizacao4',
      retAutorizacao:    'https://cte.fazenda.pr.gov.br/cte/services/CTeRetAutorizacao4',
      recepcaoEvento:    'https://cte.fazenda.pr.gov.br/cte/services/CTeRecepcaoEvento4',
      consultaProtocolo: 'https://cte.fazenda.pr.gov.br/cte/services/CTeConsultaProtocolo4',
      statusServico:     'https://cte.fazenda.pr.gov.br/cte/services/CTeStatusServico4',
      wsdlNamespace:     'http://www.portalfiscal.inf.br/cte/wsdl/CTeRecepcao4',
    },
  },
  RS: {
    homologacao: {
      autorizacao:       'https://cte-homologacao.svrs.rs.gov.br/ws/cterecepcao/CTeRecepcao4.asmx',
      retAutorizacao:    'https://cte-homologacao.svrs.rs.gov.br/ws/cteretrecepcao/CTeRetRecepcao4.asmx',
      recepcaoEvento:    'https://cte-homologacao.svrs.rs.gov.br/ws/cterecepcaoevento/CTeRecepcaoEvento4.asmx',
      consultaProtocolo: 'https://cte-homologacao.svrs.rs.gov.br/ws/cteconsultaprotocolo/CTeConsultaProtocolo4.asmx',
      statusServico:     'https://cte-homologacao.svrs.rs.gov.br/ws/ctestatusservico/CTeStatusServico4.asmx',
      wsdlNamespace:     'http://www.portalfiscal.inf.br/cte/wsdl/CTeRecepcao4',
    },
    producao: {
      autorizacao:       'https://cte.svrs.rs.gov.br/ws/cterecepcao/CTeRecepcao4.asmx',
      retAutorizacao:    'https://cte.svrs.rs.gov.br/ws/cteretrecepcao/CTeRetRecepcao4.asmx',
      recepcaoEvento:    'https://cte.svrs.rs.gov.br/ws/cterecepcaoevento/CTeRecepcaoEvento4.asmx',
      consultaProtocolo: 'https://cte.svrs.rs.gov.br/ws/cteconsultaprotocolo/CTeConsultaProtocolo4.asmx',
      statusServico:     'https://cte.svrs.rs.gov.br/ws/ctestatusservico/CTeStatusServico4.asmx',
      wsdlNamespace:     'http://www.portalfiscal.inf.br/cte/wsdl/CTeRecepcao4',
    },
  },
  BA: {
    homologacao: {
      autorizacao:       'https://hba.cte.fazenda.gov.br/cte/services/CTeAutorizacao4',
      retAutorizacao:    'https://hba.cte.fazenda.gov.br/cte/services/CTeRetAutorizacao4',
      recepcaoEvento:    'https://hba.cte.fazenda.gov.br/cte/services/CTeRecepcaoEvento4',
      consultaProtocolo: 'https://hba.cte.fazenda.gov.br/cte/services/CTeConsultaProtocolo4',
      statusServico:     'https://hba.cte.fazenda.gov.br/cte/services/CTeStatusServico4',
      wsdlNamespace:     'http://www.portalfiscal.inf.br/cte/wsdl/CTeRecepcao4',
    },
    producao: {
      autorizacao:       'https://ba.cte.fazenda.gov.br/cte/services/CTeAutorizacao4',
      retAutorizacao:    'https://ba.cte.fazenda.gov.br/cte/services/CTeRetAutorizacao4',
      recepcaoEvento:    'https://ba.cte.fazenda.gov.br/cte/services/CTeRecepcaoEvento4',
      consultaProtocolo: 'https://ba.cte.fazenda.gov.br/cte/services/CTeConsultaProtocolo4',
      statusServico:     'https://ba.cte.fazenda.gov.br/cte/services/CTeStatusServico4',
      wsdlNamespace:     'http://www.portalfiscal.inf.br/cte/wsdl/CTeRecepcao4',
    },
  },
}

export const UF_IBGE_CODES_CTE: Record<string, string> = {
  AC: '12', AL: '27', AM: '13', AP: '16', BA: '29', CE: '23',
  DF: '53', ES: '32', GO: '52', MA: '21', MG: '31', MS: '50',
  MT: '51', PA: '15', PB: '25', PE: '26', PI: '22', PR: '41',
  RJ: '33', RN: '24', RO: '11', RR: '14', RS: '43', SC: '42',
  SE: '28', SP: '35', TO: '17',
}

export const NFE_DISTRIBUICAO_ENDPOINT = {
  homologacao: 'https://hom1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx',
  producao:    'https://www1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx',
} as const

export function getCteUrls(uf: string, environment: 'homologacao' | 'producao'): CteUrls {
  const mockBase = process.env['MOCK_SEFAZ_URL']
  if (mockBase) {
    return {
      autorizacao:       `${mockBase}/ws/CTeAutorizacao4.asmx`,
      retAutorizacao:    `${mockBase}/ws/CTeRetAutorizacao4.asmx`,
      recepcaoEvento:    `${mockBase}/ws/CTeRecepcaoEvento.asmx`,
      consultaProtocolo: `${mockBase}/ws/CTeConsultaProtocolo4.asmx`,
      statusServico:     `${mockBase}/ws/CTeStatusServico4.asmx`,
      wsdlNamespace:     'http://www.portalfiscal.inf.br/cte/wsdl/CTeRecepcao4',
    }
  }
  return STATE_CTE_ENDPOINTS[uf]?.[environment] ?? SVRS_CTE[environment]
}
