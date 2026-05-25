import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from "node:crypto";

import {
  ALGORITHM,
  IV_LENGTH,
  SALT,
  TAG_LENGTH,
} from "./constants/crypto.constants";
import type { DecryptParams, EncryptParams } from "./types/crypto.types";

/**
 * Derives a 32-byte key from an arbitrary-length secret using scrypt.
 */
function deriveKey(secret: string): Buffer {
  return scryptSync(secret, SALT, 32);
}

/**
 * Encrypts `plaintext` using AES-256-GCM.
 * Returns a base64 string: iv(12) + tag(16) + ciphertext
 */
export function encrypt({ plaintext, secret }: EncryptParams): string {
  const key = deriveKey(secret);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

/**
 * Decrypts a base64 string produced by `encrypt`.
 * Throws if the auth tag is invalid (tampered data).
 */
export function decrypt({ encoded, secret }: DecryptParams): string {
  const key = deriveKey(secret);
  const data = Buffer.from(encoded, "base64");

  const iv = data.subarray(0, IV_LENGTH);
  const tag = data.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const ciphertext = data.subarray(IV_LENGTH + TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  return decipher.update(ciphertext) + decipher.final("utf8");
}
