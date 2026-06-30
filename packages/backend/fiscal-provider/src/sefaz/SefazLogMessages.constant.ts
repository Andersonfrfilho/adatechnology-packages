export const CERT_LOG = {
  LOADED: 'Certificado A1 carregado',
  LOAD_ERROR: 'Falha ao carregar certificado A1',
} as const

export const NFE_LOG = {
  EMIT_START: 'Iniciando emissão NF-e via SEFAZ',
  CHAVE_GERADA: 'Chave de acesso NF-e gerada',
  XML_GERADO: 'XML NF-e gerado',
  XML_ASSINADO: 'XML NF-e assinado digitalmente',
  XML_SIGN_ERROR: 'Falha ao assinar XML da NF-e',
  EMIT_ENVIANDO: 'Enviando NF-e para SEFAZ',
  EMIT_SUCCESS: 'NF-e autorizada com sucesso pela SEFAZ',
  EMIT_REJECTED: 'NF-e rejeitada pela SEFAZ',
  NFEDATA_MISSING: 'Emissão NF-e rejeitada localmente: nfeData ausente',
  CANCEL_START: 'Iniciando cancelamento NF-e via SEFAZ',
  CANCEL_SUCCESS: 'NF-e cancelada com sucesso',
  CANCEL_REJECTED: 'Cancelamento NF-e rejeitado pela SEFAZ',
  CANCEL_CHAVE_INVALID: 'Cancelamento NF-e rejeitado localmente: chaveAcesso inválida',
  CANCEL_PROTOCOLO_MISSING: 'Cancelamento NF-e rejeitado localmente: protocolo ausente',
  CANCEL_JUSTIFICATIVA_SHORT: 'Cancelamento NF-e rejeitado localmente: justificativa muito curta',
  STATUS_CHECK: 'Verificando status do serviço SEFAZ NF-e',
  STATUS_RESULT: 'Status SEFAZ NF-e obtido',
} as const

export const NFCE_LOG = {
  EMIT_START: 'Iniciando emissão NFC-e via SEFAZ',
  CHAVE_GERADA: 'Chave de acesso gerada',
  XML_GERADO: 'XML NFC-e gerado',
  XML_ASSINADO: 'XML NFC-e assinado digitalmente',
  XML_SIGN_ERROR: 'Falha ao assinar XML da NFC-e',
  EMIT_ENVIANDO: 'Enviando NFC-e para SEFAZ',
  EMIT_SUCCESS: 'NFC-e autorizada com sucesso pela SEFAZ',
  EMIT_REJECTED: 'NFC-e rejeitada pela SEFAZ',
  CANCEL_START: 'Iniciando cancelamento NFC-e via SEFAZ',
  CANCEL_SUCCESS: 'NFC-e cancelada com sucesso',
  CANCEL_REJECTED: 'Cancelamento NFC-e rejeitado pela SEFAZ',
  CANCEL_CHAVE_INVALID: 'Cancelamento NFC-e rejeitado localmente: chaveAcesso inválida',
  CANCEL_PROTOCOLO_MISSING: 'Cancelamento NFC-e rejeitado localmente: protocolo ausente',
  CANCEL_JUSTIFICATIVA_SHORT: 'Cancelamento NFC-e rejeitado localmente: justificativa muito curta',
  STATUS_CHECK: 'Verificando status do serviço SEFAZ',
  STATUS_RESULT: 'Status SEFAZ obtido',
} as const
