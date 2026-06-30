import type { SefazUrls } from './SefazConstants'

export type { SefazUrls }

// SVRS — fallback para estados sem servidor próprio de NF-e
const SVRS_NFE: Record<'homologacao' | 'producao', SefazUrls> = {
  homologacao: {
    autorizacao:       'https://nfe-homologacao.svrs.rs.gov.br/ws/NfeAutorizacao/NfeAutorizacao4.asmx',
    retAutorizacao:    'https://nfe-homologacao.svrs.rs.gov.br/ws/NfeRetAutorizacao/NfeRetAutorizacao4.asmx',
    consultaProtocolo: 'https://nfe-homologacao.svrs.rs.gov.br/ws/NfeConsulta/NfeConsultaNDD.asmx',
    statusServico:     'https://nfe-homologacao.svrs.rs.gov.br/ws/NfeStatusServico/NfeStatusServico4.asmx',
    recepcaoEvento:    'https://nfe-homologacao.svrs.rs.gov.br/ws/RecepcaoEvento/Recepcionamento.asmx',
    wsdlNamespace:     'http://www.portalfiscal.inf.br/nfe/wsdl/NfeAutorizacao4',
  },
  producao: {
    autorizacao:       'https://nfe.svrs.rs.gov.br/ws/NfeAutorizacao/NfeAutorizacao4.asmx',
    retAutorizacao:    'https://nfe.svrs.rs.gov.br/ws/NfeRetAutorizacao/NfeRetAutorizacao4.asmx',
    consultaProtocolo: 'https://nfe.svrs.rs.gov.br/ws/NfeConsulta/NfeConsultaNDD.asmx',
    statusServico:     'https://nfe.svrs.rs.gov.br/ws/NfeStatusServico/NfeStatusServico4.asmx',
    recepcaoEvento:    'https://nfe.svrs.rs.gov.br/ws/RecepcaoEvento/Recepcionamento.asmx',
    wsdlNamespace:     'http://www.portalfiscal.inf.br/nfe/wsdl/NfeAutorizacao4',
  },
}

// Estados com servidor SEFAZ próprio para NF-e
const STATE_NFE_ENDPOINTS: Record<string, Record<'homologacao' | 'producao', SefazUrls>> = {
  SP: {
    // Namespace confirmado via WSDL real: NFeAutorizacao4 (NF maiúsculo)
    // SOAPAction: nfeAutorizacaoLote (não nfeAutorizacaoNF)
    homologacao: {
      autorizacao:       'https://homologacao.nfe.fazenda.sp.gov.br/ws/NfeAutorizacao4.asmx',
      retAutorizacao:    'https://homologacao.nfe.fazenda.sp.gov.br/ws/NfeRetAutorizacao4.asmx',
      consultaProtocolo: 'https://homologacao.nfe.fazenda.sp.gov.br/ws/NfeConsultaProtocolo4.asmx',
      statusServico:     'https://homologacao.nfe.fazenda.sp.gov.br/ws/NfeStatusServico4.asmx',
      recepcaoEvento:    'https://homologacao.nfe.fazenda.sp.gov.br/ws/RecepcaoEvento4.asmx',
      wsdlNamespace:     'http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4',
    },
    producao: {
      autorizacao:       'https://nfe.fazenda.sp.gov.br/ws/NfeAutorizacao4.asmx',
      retAutorizacao:    'https://nfe.fazenda.sp.gov.br/ws/NfeRetAutorizacao4.asmx',
      consultaProtocolo: 'https://nfe.fazenda.sp.gov.br/ws/NfeConsultaProtocolo4.asmx',
      statusServico:     'https://nfe.fazenda.sp.gov.br/ws/NfeStatusServico4.asmx',
      recepcaoEvento:    'https://nfe.fazenda.sp.gov.br/ws/RecepcaoEvento4.asmx',
      wsdlNamespace:     'http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4',
    },
  },
  MG: {
    homologacao: {
      autorizacao:       'https://hnfe.fazenda.mg.gov.br/nfe2/services/NfeAutorizacao4',
      retAutorizacao:    'https://hnfe.fazenda.mg.gov.br/nfe2/services/NfeRetAutorizacao4',
      consultaProtocolo: 'https://hnfe.fazenda.mg.gov.br/nfe2/services/NfeConsultaProtocolo4',
      statusServico:     'https://hnfe.fazenda.mg.gov.br/nfe2/services/NfeStatusServico4',
      recepcaoEvento:    'https://hnfe.fazenda.mg.gov.br/nfe2/services/NfeRecepcaoEvento4',
      wsdlNamespace:     'http://www.portalfiscal.inf.br/nfe/wsdl/NfeAutorizacao4',
    },
    producao: {
      autorizacao:       'https://nfe.fazenda.mg.gov.br/nfe2/services/NfeAutorizacao4',
      retAutorizacao:    'https://nfe.fazenda.mg.gov.br/nfe2/services/NfeRetAutorizacao4',
      consultaProtocolo: 'https://nfe.fazenda.mg.gov.br/nfe2/services/NfeConsultaProtocolo4',
      statusServico:     'https://nfe.fazenda.mg.gov.br/nfe2/services/NfeStatusServico4',
      recepcaoEvento:    'https://nfe.fazenda.mg.gov.br/nfe2/services/NfeRecepcaoEvento4',
      wsdlNamespace:     'http://www.portalfiscal.inf.br/nfe/wsdl/NfeAutorizacao4',
    },
  },
  PR: {
    homologacao: {
      autorizacao:       'https://homologacao.nfe.sefa.pr.gov.br/nfe/NfeAutorizacao4',
      retAutorizacao:    'https://homologacao.nfe.sefa.pr.gov.br/nfe/NfeRetAutorizacao4',
      consultaProtocolo: 'https://homologacao.nfe.sefa.pr.gov.br/nfe/NfeConsultaProtocolo4',
      statusServico:     'https://homologacao.nfe.sefa.pr.gov.br/nfe/NfeStatusServico4',
      recepcaoEvento:    'https://homologacao.nfe.sefa.pr.gov.br/nfe/NfeRecepcaoEvento4',
      wsdlNamespace:     'http://www.portalfiscal.inf.br/nfe/wsdl/NfeAutorizacao4',
    },
    producao: {
      autorizacao:       'https://nfe.sefa.pr.gov.br/nfe/NfeAutorizacao4',
      retAutorizacao:    'https://nfe.sefa.pr.gov.br/nfe/NfeRetAutorizacao4',
      consultaProtocolo: 'https://nfe.sefa.pr.gov.br/nfe/NfeConsultaProtocolo4',
      statusServico:     'https://nfe.sefa.pr.gov.br/nfe/NfeStatusServico4',
      recepcaoEvento:    'https://nfe.sefa.pr.gov.br/nfe/NfeRecepcaoEvento4',
      wsdlNamespace:     'http://www.portalfiscal.inf.br/nfe/wsdl/NfeAutorizacao4',
    },
  },
  RS: {
    homologacao: {
      autorizacao:       'https://nfe-homologacao.sefazrs.rs.gov.br/ws/nfe/NfeAutorizacao4.asmx',
      retAutorizacao:    'https://nfe-homologacao.sefazrs.rs.gov.br/ws/nfe/NfeRetAutorizacao4.asmx',
      consultaProtocolo: 'https://nfe-homologacao.sefazrs.rs.gov.br/ws/nfe/NfeConsultaProtocolo4.asmx',
      statusServico:     'https://nfe-homologacao.sefazrs.rs.gov.br/ws/NfeStatusServico/NfeStatusServico4.asmx',
      recepcaoEvento:    'https://nfe-homologacao.sefazrs.rs.gov.br/ws/recepcaoevento/recepcaoevento4.asmx',
      wsdlNamespace:     'http://www.portalfiscal.inf.br/nfe/wsdl/NfeAutorizacao4',
    },
    producao: {
      autorizacao:       'https://nfe.sefazrs.rs.gov.br/ws/nfe/NfeAutorizacao4.asmx',
      retAutorizacao:    'https://nfe.sefazrs.rs.gov.br/ws/nfe/NfeRetAutorizacao4.asmx',
      consultaProtocolo: 'https://nfe.sefazrs.rs.gov.br/ws/nfe/NfeConsultaProtocolo4.asmx',
      statusServico:     'https://nfe.sefazrs.rs.gov.br/ws/NfeStatusServico/NfeStatusServico4.asmx',
      recepcaoEvento:    'https://nfe.sefazrs.rs.gov.br/ws/recepcaoevento/recepcaoevento4.asmx',
      wsdlNamespace:     'http://www.portalfiscal.inf.br/nfe/wsdl/NfeAutorizacao4',
    },
  },
  RJ: {
    homologacao: {
      autorizacao:       'https://nfe-homologacao.svrs.rs.gov.br/ws/NfeAutorizacao/NfeAutorizacao4.asmx',
      retAutorizacao:    'https://nfe-homologacao.svrs.rs.gov.br/ws/NfeRetAutorizacao/NfeRetAutorizacao4.asmx',
      consultaProtocolo: 'https://nfe-homologacao.svrs.rs.gov.br/ws/NfeConsulta/NfeConsultaNDD.asmx',
      statusServico:     'https://nfe-homologacao.svrs.rs.gov.br/ws/NfeStatusServico/NfeStatusServico4.asmx',
      recepcaoEvento:    'https://nfe-homologacao.svrs.rs.gov.br/ws/RecepcaoEvento/Recepcionamento.asmx',
      wsdlNamespace:     'http://www.portalfiscal.inf.br/nfe/wsdl/NfeAutorizacao4',
    },
    producao: {
      autorizacao:       'https://nfe.svrs.rs.gov.br/ws/NfeAutorizacao/NfeAutorizacao4.asmx',
      retAutorizacao:    'https://nfe.svrs.rs.gov.br/ws/NfeRetAutorizacao/NfeRetAutorizacao4.asmx',
      consultaProtocolo: 'https://nfe.svrs.rs.gov.br/ws/NfeConsulta/NfeConsultaNDD.asmx',
      statusServico:     'https://nfe.svrs.rs.gov.br/ws/NfeStatusServico/NfeStatusServico4.asmx',
      recepcaoEvento:    'https://nfe.svrs.rs.gov.br/ws/RecepcaoEvento/Recepcionamento.asmx',
      wsdlNamespace:     'http://www.portalfiscal.inf.br/nfe/wsdl/NfeAutorizacao4',
    },
  },
}

export function getNfeUrls(uf: string, environment: 'homologacao' | 'producao'): SefazUrls {
  const mockBase = process.env['MOCK_SEFAZ_URL']
  if (mockBase) {
    return {
      autorizacao:       `${mockBase}/ws/NfeAutorizacao4.asmx`,
      retAutorizacao:    `${mockBase}/ws/NfeRetAutorizacao4.asmx`,
      consultaProtocolo: `${mockBase}/ws/NfeConsultaProtocolo4.asmx`,
      statusServico:     `${mockBase}/ws/NfeStatusServico4.asmx`,
      recepcaoEvento:    `${mockBase}/ws/NfeRecepcaoEvento4.asmx`,
      wsdlNamespace:     'http://www.portalfiscal.inf.br/nfe/wsdl/NfeAutorizacao4',
    }
  }
  return STATE_NFE_ENDPOINTS[uf]?.[environment] ?? SVRS_NFE[environment]
}
