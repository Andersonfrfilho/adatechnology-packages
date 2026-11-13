import type {
  EmitFiscalParams,
  CancelFiscalParams,
  TestConnectionParams,
  FiscalResult,
  TestConnectionResult,
} from './types'

export type FiscalProvider = {
  emit(params: EmitFiscalParams): Promise<FiscalResult>
  cancel(params: CancelFiscalParams): Promise<FiscalResult>
  testConnection(params: TestConnectionParams): Promise<TestConnectionResult>
}
