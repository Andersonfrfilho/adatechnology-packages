export type { FiscalProvider } from './FiscalProvider.interface'

export { FiscalModel, FiscalEnvironment, PaymentMethod, CteModal, CteTipoServico, CteTomador } from './types'

export {
  MdfeTipoEmitente,
  MdfeTipoTransportador,
  MdfeTipoCarga,
  MdfeUnidadeCarga,
  MdfeTipoRodado,
  MdfeTipoCarroceria,
  MdfeTipoProprietario,
  MdfeResponsavelSeguro,
} from './types'

export type {
  FiscalConfig,
  NfceConfig,
  NfeConfig,
  NfeDestinatario,
  NfeData,
  SatConfig,
  NfseConfig,
  NfseData,
  NotaRpConfig,
  NotaRpTomador,
  NotaRpNfseData,
  NfseCancelCode,
  FiscalItem,
  FiscalPayment,
  EmitFiscalParams,
  CancelFiscalParams,
  CloseMdfeParams,
  TestConnectionParams,
  FiscalResult,
  TestConnectionResult,
  DanfceData,
  CupomPdfData,
  // CT-e
  CteConfig,
  CteData,
  CteModalData,
  CteRodoviarioData,
  CteAereoData,
  CteAquaviarioData,
  CteFerroviarioData,
  CteParticipante,
  CteMunicipio,
  CteComponenteValor,
  CteQuantidadeCarga,
  CteDocumento,
  CteDocumentoNfe,
  CteDocumentoOutro,
  CteIcms,
  // MDF-e
  MdfeConfig,
  MdfeData,
  MdfeMunicipioCarregamento,
  MdfeMunicipioDescarga,
  MdfeCondutor,
  MdfeProprietarioVeiculo,
  MdfeVeiculoTracao,
  MdfeVeiculoReboque,
  MdfeSeguro,
  // NF-e Distribuição
  NfeDistribuicaoConfig,
  NfeDistribuicaoResult,
  DfeItem,
  ImportedAuthorizedNfeXml,
  ImportedUnsignedNfeXml,
  ImportedNfeEventXml,
  ImportedNfeXml,
  NfeXmlAddress,
  NfeXmlParty,
  NfeXmlProduct,
  NfeXmlVolume,
  NfeXmlTotals,
  NfeXmlProtocol,
  NfeXmlDocument,
  NfeXmlEvent,
  FiltrosDfe,
  ConsultarDFeParams,
  ConsultarPorNsuParams,
  ConsultarPorChaveParams,
} from './types'

export { isNfceSupported, NFCE_UNSUPPORTED_UFS } from './sefaz/SefazConstants'
export { buildDanfce } from './danfce/DanfceBuilder'
export { buildCupomPdf } from './danfce/CupomPdfBuilder'
export type { BuildCupomPdfParams, CupomPdfResult } from './danfce/CupomPdfBuilder'
export { buildQrCodeUrl } from './sefaz/SefazQrCode'
export { verifyQrCode, parseQrCodeUrl, computeQrCodeHash } from './sefaz/SefazQrCodeVerifier'
export type {
  VerifyQrCodeParams,
  VerifyQrCodeResult,
  QrCodeParts,
  QrCodeCheck,
  ComputeQrCodeHashParams,
} from './sefaz/SefazQrCodeVerifier'
export { isChaveDvValid } from './sefaz/SefazChave'
export { resolveErrorHint, SEFAZ_CSTAT_HINT } from './sefaz/SefazCstatHints'
export { consultarNfe, cartaCorrecao, inutilizar } from './sefaz/SefazDocumentOps'
export type { ConsultaResult } from './sefaz/SefazSoapClient'
export { validateCertificate } from './sefaz/CertificateValidator'
export type { CertificateValidation } from './sefaz/CertificateValidator'
export { evictCertificate } from './sefaz/SefazXmlSigner'

export { SefazNfceProvider } from './providers/SefazNfceProvider'
export { SefazNfeProvider } from './providers/SefazNfeProvider'
export { SatProvider } from './providers/SatProvider'
export { NfseProvider } from './providers/NfseProvider'
export { NotaRpNfseProvider } from './providers/NotaRpNfseProvider'
export { SefazCteProvider } from './providers/SefazCteProvider'
export { SefazMdfeProvider } from './providers/SefazMdfeProvider'
export { NfeDistribuicaoProvider, consultarCnpj, importarNfeXml } from './providers/NfeDistribuicaoProvider'
export type { CnpjInfo } from './providers/NfeDistribuicaoProvider'
export { createFiscalProvider } from './FiscalProviderFactory'

export { FiscalError, FiscalConnectionError, FiscalRejectionError, FiscalTimeoutError } from './errors/FiscalError'
export { NFE_XML_IMPORT_ERROR_CODE, NfeXmlImportError, type NfeXmlImportErrorCode } from './errors/NfeXmlImport.error'
