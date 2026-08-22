/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Assinatura/verificação de access token via `jose`. Viver aqui (não no host) é o que torna isto
 * um módulo de verdade — o host nunca lê nem valida o JWT diretamente.
 */

import { jwtVerify, SignJWT } from 'jose'
import type { UserProfile } from '@adatechnology/user-contracts'

const DEFAULT_ACCESS_TOKEN_EXPIRES_IN_SECONDS = 15 * 60
const JWT_ALGORITHM = 'HS256'

export type AccessTokenClaims = {
  readonly sub: string
  readonly email: string
  readonly role: string
  readonly companyId?: string
}

export class TokenService {
  private readonly secretKey: Uint8Array
  private readonly expiresInSeconds: number
  private readonly issuer: string | undefined
  private readonly audience: string | undefined

  constructor(params: {
    readonly secret: string
    readonly expiresInSeconds?: number
    readonly issuer?: string
    readonly audience?: string
  }) {
    this.secretKey = new TextEncoder().encode(params.secret)
    this.expiresInSeconds = params.expiresInSeconds ?? DEFAULT_ACCESS_TOKEN_EXPIRES_IN_SECONDS
    this.issuer = params.issuer
    this.audience = params.audience
  }

  async sign(profile: UserProfile): Promise<{ accessToken: string; expiresInSeconds: number }> {
    const claims: AccessTokenClaims = {
      sub: profile.id,
      email: profile.email,
      role: profile.role,
      ...(profile.companyId ? { companyId: profile.companyId } : {}),
    }

    let builder = new SignJWT({ ...claims })
      .setProtectedHeader({ alg: JWT_ALGORITHM })
      .setSubject(profile.id)
      .setIssuedAt()
      .setExpirationTime(`${this.expiresInSeconds}s`)

    if (this.issuer) builder = builder.setIssuer(this.issuer)
    if (this.audience) builder = builder.setAudience(this.audience)

    const accessToken = await builder.sign(this.secretKey)

    return { accessToken, expiresInSeconds: this.expiresInSeconds }
  }

  async verify(accessToken: string): Promise<AccessTokenClaims | undefined> {
    try {
      const { payload } = await jwtVerify(accessToken, this.secretKey, {
        algorithms: [JWT_ALGORITHM],
        ...(this.issuer ? { issuer: this.issuer } : {}),
        ...(this.audience ? { audience: this.audience } : {}),
      })
      if (typeof payload.sub !== 'string' || typeof payload.email !== 'string' || typeof payload.role !== 'string') {
        return undefined
      }
      return {
        sub: payload.sub,
        email: payload.email,
        role: payload.role,
        ...(typeof payload.companyId === 'string' ? { companyId: payload.companyId } : {}),
      }
    } catch {
      return undefined
    }
  }
}
