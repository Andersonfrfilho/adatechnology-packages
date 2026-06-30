export type { FiscalProvider } from './FiscalProvider.interface'

export { FiscalModel, FiscalEnvironment, PaymentMethod } from './types'

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
  TestConnectionParams,
  FiscalResult,
  TestConnectionResult,
  DanfceData,
} from './types'

export { isNfceSupported, NFCE_UNSUPPORTED_UFS } from './sefaz/SefazConstants'
export { buildDanfce } from './danfce/DanfceBuilder'
export { buildQrCodeUrl } from './sefaz/SefazQrCode'
export { validateCertificate } from './sefaz/CertificateValidator'
export type { CertificateValidation } from './sefaz/CertificateValidator'
export { evictCertificate } from './sefaz/SefazXmlSigner'

export { SefazNfceProvider } from './providers/SefazNfceProvider'
export { SefazNfeProvider } from './providers/SefazNfeProvider'
export { SatProvider } from './providers/SatProvider'
export { NfseProvider } from './providers/NfseProvider'
export { NotaRpNfseProvider } from './providers/NotaRpNfseProvider'
export { createFiscalProvider } from './FiscalProviderFactory'

export {
  FiscalError,
  FiscalConnectionError,
  FiscalRejectionError,
  FiscalTimeoutError,
} from './errors/FiscalError'
