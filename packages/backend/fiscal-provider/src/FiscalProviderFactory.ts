import type { FiscalProvider } from './FiscalProvider.interface'
import type { FiscalConfig } from './types'
import { SefazNfceProvider } from './providers/SefazNfceProvider'
import { SefazNfeProvider } from './providers/SefazNfeProvider'
import { SatProvider } from './providers/SatProvider'
import { NfseProvider } from './providers/NfseProvider'
import { NotaRpNfseProvider } from './providers/NotaRpNfseProvider'
import { SefazCteProvider } from './providers/SefazCteProvider'

export function createFiscalProvider(config: FiscalConfig): FiscalProvider {
  if (config.model === 'nfce')             return new SefazNfceProvider()
  if (config.model === 'nfe')              return new SefazNfeProvider()
  if (config.model === 'sat')              return new SatProvider()
  if (config.model === 'nfse')             return new NfseProvider()
  if (config.model === 'nfse-notarp')      return new NotaRpNfseProvider()
  if (config.model === 'cte')             return new SefazCteProvider()
  if (config.model === 'nfe-distribuicao') throw new Error('NfeDistribuicaoProvider não segue a interface FiscalProvider — instancie NfeDistribuicaoProvider diretamente')

  const _exhaustive: never = config
  throw new Error(`Modelo fiscal desconhecido: ${JSON.stringify(_exhaustive)}`)
}
