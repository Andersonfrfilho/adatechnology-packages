/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */
import { SECRET_ENVELOPE_ALGORITHM, SECRET_ENVELOPE_VERSION } from './secret-envelope.constant'

const TEXT_ENCODER = new TextEncoder()
const AUTHENTICATED_DATA_DOMAIN = TEXT_ENCODER.encode('adatechnology:secret-envelope')

type CreateAuthenticatedDataInput = Readonly<{
  keyId: string
  additionalAuthenticatedData: Uint8Array<ArrayBuffer>
}>

export function createAuthenticatedData(input: CreateAuthenticatedDataInput): Uint8Array<ArrayBuffer> {
  return frameFields([
    AUTHENTICATED_DATA_DOMAIN,
    new Uint8Array([SECRET_ENVELOPE_VERSION]),
    TEXT_ENCODER.encode(SECRET_ENVELOPE_ALGORITHM),
    TEXT_ENCODER.encode(input.keyId),
    input.additionalAuthenticatedData,
  ])
}

function frameFields(fields: readonly Uint8Array[]): Uint8Array<ArrayBuffer> {
  const size = fields.reduce((total, field) => total + 4 + field.byteLength, 0)
  const frame = new Uint8Array(size)
  const view = new DataView(frame.buffer)
  let offset = 0

  for (const field of fields) {
    view.setUint32(offset, field.byteLength, false)
    offset += 4
    frame.set(field, offset)
    offset += field.byteLength
  }

  return frame
}
