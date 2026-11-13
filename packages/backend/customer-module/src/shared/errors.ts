/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { CUSTOMER_ERROR_CODE, CustomerError } from '@adatechnology/customer-contracts'

export class ConfigMissingError extends CustomerError {
  constructor(message: string) {
    super(message, CUSTOMER_ERROR_CODE.CONFIG_MISSING)
  }
}
