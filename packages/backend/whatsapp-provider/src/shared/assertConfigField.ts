import { WhatsAppConfigError } from '../errors/WhatsAppError'

export function assertConfigField<TValue>(value: TValue | undefined, fieldName: string): TValue {
  if (value === undefined || value === '') throw new WhatsAppConfigError(fieldName)
  return value
}
