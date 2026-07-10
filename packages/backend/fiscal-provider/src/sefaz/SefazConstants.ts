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

/**
 * UFs que NÃO aderiram ao NFC-e (modelo 65) e o modelo fiscal correto a usar.
 *
 * SP — São Paulo (atualizado 2026)
 *   NFC-e (modelo 65) é o documento padrão do varejo desde 01/01/2026
 *   (substitui CF-e-SAT). Webservices próprios da SEFAZ-SP.
 *   Ref: https://portal.fazenda.sp.gov.br/servicos/nfce
 *
 * CE — Ceará
 *   Não emite NFC-e. Utilizar:
 *   - MFE (Módulo Fiscal Eletrônico) — equivalente estadual do SAT, equipamento físico
 *   - NF-e modelo 55 para demais operações
 *   ⚠️ O provider SAT atual não cobre MFE do CE — requer implementação específica.
 *
 * Demais estados: aderiram ao NFC-e via SVRS ou SEFAZ própria — usar modelo `nfce`.
 */
export const NFCE_UNSUPPORTED_UFS = new Set(['CE'])

/** Retorna true se o estado emite NFC-e (modelo 65). */
export function isNfceSupported(uf: string): boolean {
  return !NFCE_UNSUPPORTED_UFS.has(uf.toUpperCase())
}

// Estados com SEFAZ própria para NFC-e
const STATE_NFCE_ENDPOINTS: Record<string, Record<'homologacao' | 'producao', SefazUrls>> = {
  // Fontes oficiais: portal.fazenda.sp.gov.br/servicos/nfce (WebServices) + dfe-portal.svrs.rs.gov.br
  SP: {
    homologacao: {
      autorizacao:      'https://homologacao.nfce.fazenda.sp.gov.br/ws/NFeAutorizacao4.asmx',
      retAutorizacao:   'https://homologacao.nfce.fazenda.sp.gov.br/ws/NFeRetAutorizacao4.asmx',
      consultaProtocolo:'https://homologacao.nfce.fazenda.sp.gov.br/ws/NFeConsultaProtocolo4.asmx',
      statusServico:    'https://homologacao.nfce.fazenda.sp.gov.br/ws/NFeStatusServico4.asmx',
      recepcaoEvento:   'https://homologacao.nfce.fazenda.sp.gov.br/ws/NFeRecepcaoEvento4.asmx',
      wsdlNamespace:    'http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4',
    },
    producao: {
      autorizacao:      'https://nfce.fazenda.sp.gov.br/ws/NFeAutorizacao4.asmx',
      retAutorizacao:   'https://nfce.fazenda.sp.gov.br/ws/NFeRetAutorizacao4.asmx',
      consultaProtocolo:'https://nfce.fazenda.sp.gov.br/ws/NFeConsultaProtocolo4.asmx',
      statusServico:    'https://nfce.fazenda.sp.gov.br/ws/NFeStatusServico4.asmx',
      recepcaoEvento:   'https://nfce.fazenda.sp.gov.br/ws/NFeRecepcaoEvento4.asmx',
      wsdlNamespace:    'http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4',
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
  const mockBase = process.env['MOCK_SEFAZ_URL']
  if (mockBase) {
    return {
      autorizacao:       `${mockBase}/ws/NfceAutorizacao4.asmx`,
      retAutorizacao:    `${mockBase}/ws/NfceRetAutorizacao4.asmx`,
      consultaProtocolo: `${mockBase}/ws/NfceConsultaProtocolo4.asmx`,
      statusServico:     `${mockBase}/ws/NfceStatusServico4.asmx`,
      recepcaoEvento:    `${mockBase}/ws/NfceRecepcaoEvento4.asmx`,
      wsdlNamespace:     'http://www.portalfiscal.inf.br/nfe/wsdl/NfceAutorizacao4',
    }
  }
  return STATE_NFCE_ENDPOINTS[uf]?.[environment] ?? SVRS_NFCE[environment]
}

// Códigos SEFAZ que indicam indisponibilidade temporária — passíveis de retry
export const SEFAZ_RETRYABLE_CODES = new Set(['108', '109', '110', '999'])

// ─── QR Code URLs por UF ──────────────────────────────────────────────────────

export type SefazQrCodeInfo = {
  readonly qrCode: string
  readonly urlFe: string
}

const SVRS_QRCODE: Record<'homologacao' | 'producao', SefazQrCodeInfo> = {
  homologacao: {
    qrCode: 'https://www.homologacao.nfce.fazenda.gov.br/qrcode',
    urlFe:  'https://www.homologacao.nfce.fazenda.gov.br/consulta',
  },
  producao: {
    qrCode: 'https://www.nfce.fazenda.gov.br/qrcode',
    urlFe:  'https://www.nfce.fazenda.gov.br/consulta',
  },
}

const STATE_NFCE_QRCODE: Record<string, Record<'homologacao' | 'producao', SefazQrCodeInfo>> = {
  SP: {
    homologacao: {
      qrCode: 'https://www.homologacao.nfce.fazenda.sp.gov.br/qrcode',
      urlFe:  'https://www.homologacao.nfce.fazenda.sp.gov.br/NFCeConsultaPublica',
    },
    producao: {
      qrCode: 'https://www.nfce.fazenda.sp.gov.br/qrcode',
      urlFe:  'https://www.nfce.fazenda.sp.gov.br/NFCeConsultaPublica',
    },
  },
  MG: {
    homologacao: {
      qrCode: 'https://hnfe.fazenda.mg.gov.br/portalnfce/sistema/qrcode',
      urlFe:  'https://hnfe.fazenda.mg.gov.br/portalnfce',
    },
    producao: {
      qrCode: 'https://portalsped.fazenda.mg.gov.br/portalnfce/sistema/qrcode',
      urlFe:  'https://portalsped.fazenda.mg.gov.br/portalnfce',
    },
  },
  RS: {
    homologacao: {
      qrCode: 'https://www.sefaz.rs.gov.br/NFCE/NFCE-COM.aspx',
      urlFe:  'https://www.sefaz.rs.gov.br/NFCE',
    },
    producao: {
      qrCode: 'https://www.sefaz.rs.gov.br/NFCE/NFCE-COM.aspx',
      urlFe:  'https://www.sefaz.rs.gov.br/NFCE',
    },
  },
  PR: {
    homologacao: {
      qrCode: 'https://homologacao.nfe.sefa.pr.gov.br/nfce/qrcode',
      urlFe:  'https://homologacao.nfe.sefa.pr.gov.br/nfce',
    },
    producao: {
      qrCode: 'https://www.nfe.sefa.pr.gov.br/nfce/qrcode',
      urlFe:  'https://www.nfe.sefa.pr.gov.br/nfce',
    },
  },
}

export function getSefazQrCodeInfo(uf: string, environment: 'homologacao' | 'producao'): SefazQrCodeInfo {
  return STATE_NFCE_QRCODE[uf]?.[environment] ?? SVRS_QRCODE[environment]
}
