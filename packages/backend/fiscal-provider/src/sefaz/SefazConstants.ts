export const UF_IBGE_CODES: Record<string, string> = {
  AC: '12', AL: '27', AM: '13', AP: '16', BA: '29',
  CE: '23', DF: '53', ES: '32', GO: '52', MA: '21',
  MG: '31', MS: '50', MT: '51', PA: '15', PB: '25',
  PE: '26', PI: '22', PR: '41', RJ: '33', RN: '24',
  RO: '11', RR: '14', RS: '43', SC: '42', SE: '28',
  SP: '35', TO: '17',
}

export type SefazUrls = {
  readonly autorizacao: string
  readonly retAutorizacao: string
  readonly consultaProtocolo: string
  readonly statusServico: string
  readonly recepcaoEvento: string
  readonly wsdlNamespace: string
}

// SVRS — SEFAZ Virtual Rio Grande do Sul (NFC-e para estados sem SEFAZ própria)
const SVRS_NFCE: Record<'homologacao' | 'producao', SefazUrls> = {
  homologacao: {
    autorizacao:      'https://nfe-homologacao.svrs.rs.gov.br/ws/NfceAutorizacao/NfceAutorizacao4.asmx',
    retAutorizacao:   'https://nfe-homologacao.svrs.rs.gov.br/ws/NfceRetAutorizacao/NfceRetAutorizacao4.asmx',
    consultaProtocolo:'https://nfe-homologacao.svrs.rs.gov.br/ws/NfceConsulta/NfceConsultaNDD.asmx',
    statusServico:    'https://nfe-homologacao.svrs.rs.gov.br/ws/NfceStatusServico/NfceStatusServico4.asmx',
    recepcaoEvento:   'https://nfe-homologacao.svrs.rs.gov.br/ws/RecepcaoEvento/Recepcionamento.asmx',
    wsdlNamespace:    'http://www.portalfiscal.inf.br/nfe/wsdl/NfceAutorizacao4',
  },
  producao: {
    autorizacao:      'https://nfe.svrs.rs.gov.br/ws/NfceAutorizacao/NfceAutorizacao4.asmx',
    retAutorizacao:   'https://nfe.svrs.rs.gov.br/ws/NfceRetAutorizacao/NfceRetAutorizacao4.asmx',
    consultaProtocolo:'https://nfe.svrs.rs.gov.br/ws/NfceConsulta/NfceConsultaNDD.asmx',
    statusServico:    'https://nfe.svrs.rs.gov.br/ws/NfceStatusServico/NfceStatusServico4.asmx',
    recepcaoEvento:   'https://nfe.svrs.rs.gov.br/ws/RecepcaoEvento/Recepcionamento.asmx',
    wsdlNamespace:    'http://www.portalfiscal.inf.br/nfe/wsdl/NfceAutorizacao4',
  },
}

// Estados com SEFAZ própria para NFC-e
const STATE_NFCE_ENDPOINTS: Record<string, Record<'homologacao' | 'producao', SefazUrls>> = {
  SP: {
    homologacao: {
      autorizacao:      'https://homologacao.nfce.fazenda.sp.gov.br/nfceweb/services/NfceAutorizacao4.asmx',
      retAutorizacao:   'https://homologacao.nfce.fazenda.sp.gov.br/nfceweb/services/NfceRetAutorizacao4.asmx',
      consultaProtocolo:'https://homologacao.nfce.fazenda.sp.gov.br/nfceweb/services/NfceConsultaProtocolo4.asmx',
      statusServico:    'https://homologacao.nfce.fazenda.sp.gov.br/nfceweb/services/NfceStatusServico4.asmx',
      recepcaoEvento:   'https://homologacao.nfce.fazenda.sp.gov.br/nfceweb/services/NfceRecepcaoEvento4.asmx',
      wsdlNamespace:    'http://www.portalfiscal.inf.br/nfe/wsdl/NfceAutorizacao4',
    },
    producao: {
      autorizacao:      'https://nfce.fazenda.sp.gov.br/nfceweb/services/NfceAutorizacao4.asmx',
      retAutorizacao:   'https://nfce.fazenda.sp.gov.br/nfceweb/services/NfceRetAutorizacao4.asmx',
      consultaProtocolo:'https://nfce.fazenda.sp.gov.br/nfceweb/services/NfceConsultaProtocolo4.asmx',
      statusServico:    'https://nfce.fazenda.sp.gov.br/nfceweb/services/NfceStatusServico4.asmx',
      recepcaoEvento:   'https://nfce.fazenda.sp.gov.br/nfceweb/services/NfceRecepcaoEvento4.asmx',
      wsdlNamespace:    'http://www.portalfiscal.inf.br/nfe/wsdl/NfceAutorizacao4',
    },
  },
  MG: {
    homologacao: {
      autorizacao:      'https://hnfe.fazenda.mg.gov.br/nfe2/services/NfceAutorizacao4',
      retAutorizacao:   'https://hnfe.fazenda.mg.gov.br/nfe2/services/NfceRetAutorizacao4',
      consultaProtocolo:'https://hnfe.fazenda.mg.gov.br/nfe2/services/NfceConsultaProtocolo4',
      statusServico:    'https://hnfe.fazenda.mg.gov.br/nfe2/services/NfceStatusServico4',
      recepcaoEvento:   'https://hnfe.fazenda.mg.gov.br/nfe2/services/NfceRecepcaoEvento4',
      wsdlNamespace:    'http://www.portalfiscal.inf.br/nfe/wsdl/NfceAutorizacao4',
    },
    producao: {
      autorizacao:      'https://nfe.fazenda.mg.gov.br/nfe2/services/NfceAutorizacao4',
      retAutorizacao:   'https://nfe.fazenda.mg.gov.br/nfe2/services/NfceRetAutorizacao4',
      consultaProtocolo:'https://nfe.fazenda.mg.gov.br/nfe2/services/NfceConsultaProtocolo4',
      statusServico:    'https://nfe.fazenda.mg.gov.br/nfe2/services/NfceStatusServico4',
      recepcaoEvento:   'https://nfe.fazenda.mg.gov.br/nfe2/services/NfceRecepcaoEvento4',
      wsdlNamespace:    'http://www.portalfiscal.inf.br/nfe/wsdl/NfceAutorizacao4',
    },
  },
  RS: {
    homologacao: {
      autorizacao:      'https://nfe-homologacao.sefazrs.rs.gov.br/ws/nfceautorizacao/NfceAutorizacao4.asmx',
      retAutorizacao:   'https://nfe-homologacao.sefazrs.rs.gov.br/ws/nfceretautorizacao/NfceRetAutorizacao4.asmx',
      consultaProtocolo:'https://nfe-homologacao.sefazrs.rs.gov.br/ws/nfceconsultaprotocolo/NfceConsultaProtocolo4.asmx',
      statusServico:    'https://nfe-homologacao.sefazrs.rs.gov.br/ws/NfceStatusServico/NfceStatusServico4.asmx',
      recepcaoEvento:   'https://nfe-homologacao.sefazrs.rs.gov.br/ws/recepcaoevento/recepcaoevento4.asmx',
      wsdlNamespace:    'http://www.portalfiscal.inf.br/nfe/wsdl/NfceAutorizacao4',
    },
    producao: {
      autorizacao:      'https://nfe.sefazrs.rs.gov.br/ws/nfceautorizacao/NfceAutorizacao4.asmx',
      retAutorizacao:   'https://nfe.sefazrs.rs.gov.br/ws/nfceretautorizacao/NfceRetAutorizacao4.asmx',
      consultaProtocolo:'https://nfe.sefazrs.rs.gov.br/ws/nfceconsultaprotocolo/NfceConsultaProtocolo4.asmx',
      statusServico:    'https://nfe.sefazrs.rs.gov.br/ws/NfceStatusServico/NfceStatusServico4.asmx',
      recepcaoEvento:   'https://nfe.sefazrs.rs.gov.br/ws/recepcaoevento/recepcaoevento4.asmx',
      wsdlNamespace:    'http://www.portalfiscal.inf.br/nfe/wsdl/NfceAutorizacao4',
    },
  },
  PR: {
    homologacao: {
      autorizacao:      'https://homologacao.nfe.sefa.pr.gov.br/nfce/NfceAutorizacao4',
      retAutorizacao:   'https://homologacao.nfe.sefa.pr.gov.br/nfce/NfceRetAutorizacao4',
      consultaProtocolo:'https://homologacao.nfe.sefa.pr.gov.br/nfce/NfceConsultaProtocolo4',
      statusServico:    'https://homologacao.nfe.sefa.pr.gov.br/nfce/NfceStatusServico4',
      recepcaoEvento:   'https://homologacao.nfe.sefa.pr.gov.br/nfce/NfceRecepcaoEvento4',
      wsdlNamespace:    'http://www.portalfiscal.inf.br/nfe/wsdl/NfceAutorizacao4',
    },
    producao: {
      autorizacao:      'https://nfe.sefa.pr.gov.br/nfce/NfceAutorizacao4',
      retAutorizacao:   'https://nfe.sefa.pr.gov.br/nfce/NfceRetAutorizacao4',
      consultaProtocolo:'https://nfe.sefa.pr.gov.br/nfce/NfceConsultaProtocolo4',
      statusServico:    'https://nfe.sefa.pr.gov.br/nfce/NfceStatusServico4',
      recepcaoEvento:   'https://nfe.sefa.pr.gov.br/nfce/NfceRecepcaoEvento4',
      wsdlNamespace:    'http://www.portalfiscal.inf.br/nfe/wsdl/NfceAutorizacao4',
    },
  },
}

export function getSefazUrls(uf: string, environment: 'homologacao' | 'producao'): SefazUrls {
  return STATE_NFCE_ENDPOINTS[uf]?.[environment] ?? SVRS_NFCE[environment]
}

// Códigos SEFAZ que indicam indisponibilidade temporária — passíveis de retry
export const SEFAZ_RETRYABLE_CODES = new Set(['108', '109', '110', '999'])
