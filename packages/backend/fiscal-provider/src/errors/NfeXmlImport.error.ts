/**
 * Copyright (c) 2026 Ada Technology.
 * Licensed under the MIT License.
 */

import { FiscalError } from './FiscalError'

export const NFE_XML_IMPORT_ERROR_CODE = Object.freeze({
  accessKeyMismatch: 'NFE_XML_ACCESS_KEY_MISMATCH',
  eventMismatch: 'NFE_XML_EVENT_MISMATCH',
  forbiddenDeclaration: 'NFE_XML_FORBIDDEN_DECLARATION',
  invalidAccessKey: 'NFE_XML_INVALID_ACCESS_KEY',
  invalidStructure: 'NFE_XML_INVALID_STRUCTURE',
  tooLarge: 'NFE_XML_TOO_LARGE',
  unsupportedDocument: 'NFE_XML_UNSUPPORTED_DOCUMENT',
} as const)

export type NfeXmlImportErrorCode = (typeof NFE_XML_IMPORT_ERROR_CODE)[keyof typeof NFE_XML_IMPORT_ERROR_CODE]

export class NfeXmlImportError extends FiscalError {
  override readonly name = 'NfeXmlImportError'

  constructor(params: { readonly code: NfeXmlImportErrorCode; readonly message: string }) {
    super(params.message, params.code, params.message, null)
  }
}
