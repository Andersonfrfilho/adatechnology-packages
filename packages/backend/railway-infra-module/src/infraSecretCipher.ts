/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

import {
  INFRA_SECRET_AAD_PREFIX,
  INFRA_SECRET_ALGORITHM,
  INFRA_SECRET_FORMAT_VERSION,
  INFRA_SECRET_IV_BYTES,
  INFRA_SECRET_PART_COUNT,
  INFRA_SECRET_TAG_BYTES,
  INFRA_SECRET_UNREADABLE_REASON,
} from '@adatechnology/railway-infra-contracts'
import { InfraSecretUnreadableError } from '@adatechnology/railway-infra-contracts'
import type { InfraSecretKey } from './infraSecretKey'
import type { OpenSecretParams, SealSecretParams } from './types/infraSecret.types'

const ENCODING = 'base64url'
const TEXT = 'utf8'
const { MALFORMED, KEY_MISMATCH, AUTHENTICATION_FAILED } = INFRA_SECRET_UNREADABLE_REASON

type AadParams = { readonly key: InfraSecretKey; readonly provider: string; readonly workspaceId: string }

function buildAad(params: AadParams): Buffer {
  return Buffer.from(`${INFRA_SECRET_AAD_PREFIX}|${params.key.keyId}|${params.provider}|${params.workspaceId}`, TEXT)
}

export function sealSecret(params: SealSecretParams): string {
  if (params.plaintext.length === 0) throw new RangeError('plaintext must not be empty')
  const iv = randomBytes(INFRA_SECRET_IV_BYTES)
  const cipher = params.key.use((keyBytes) =>
    createCipheriv(INFRA_SECRET_ALGORITHM, keyBytes, iv, { authTagLength: INFRA_SECRET_TAG_BYTES }),
  )
  cipher.setAAD(buildAad(params))
  const data = Buffer.concat([cipher.update(params.plaintext, TEXT), cipher.final()])
  return [
    INFRA_SECRET_FORMAT_VERSION,
    params.key.keyId,
    iv.toString(ENCODING),
    cipher.getAuthTag().toString(ENCODING),
    data.toString(ENCODING),
  ].join('.')
}

type ParsedSecret = { readonly iv: Buffer; readonly tag: Buffer; readonly data: Buffer }

function parseSealed(params: OpenSecretParams): ParsedSecret {
  const parts = params.sealed.split('.')
  const [version, keyId, ivPart, tagPart, dataPart] = parts
  if (parts.length !== INFRA_SECRET_PART_COUNT || version !== INFRA_SECRET_FORMAT_VERSION) {
    throw new InfraSecretUnreadableError(MALFORMED)
  }
  if (keyId !== params.key.keyId) throw new InfraSecretUnreadableError(KEY_MISMATCH)
  const iv = Buffer.from(ivPart ?? '', ENCODING)
  const tag = Buffer.from(tagPart ?? '', ENCODING)
  if (iv.length !== INFRA_SECRET_IV_BYTES || tag.length !== INFRA_SECRET_TAG_BYTES) {
    throw new InfraSecretUnreadableError(MALFORMED)
  }
  return { iv, tag, data: Buffer.from(dataPart ?? '', ENCODING) }
}

export function openSecret(params: OpenSecretParams): string {
  const { iv, tag, data } = parseSealed(params)
  try {
    const decipher = params.key.use((keyBytes) =>
      createDecipheriv(INFRA_SECRET_ALGORITHM, keyBytes, iv, { authTagLength: INFRA_SECRET_TAG_BYTES }),
    )
    decipher.setAAD(buildAad(params))
    decipher.setAuthTag(tag)
    return Buffer.concat([decipher.update(data), decipher.final()]).toString(TEXT)
  } catch {
    throw new InfraSecretUnreadableError(AUTHENTICATION_FAILED)
  }
}
