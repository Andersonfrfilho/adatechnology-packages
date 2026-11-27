/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { isIP } from 'node:net'

export const TRUSTED_PROXY_HEADER = {
  NONE: 'none',
  X_REAL_IP: 'x-real-ip',
  X_FORWARDED_FOR: 'x-forwarded-for',
} as const
export type TrustedProxyHeader = (typeof TRUSTED_PROXY_HEADER)[keyof typeof TRUSTED_PROXY_HEADER]

export const UNKNOWN_CLIENT_IP = 'unknown'

const MAPPED_IPV4_PREFIX = '::ffff:'
const IPV6_HEXTETS = 8
const IPV6_NETWORK_HEXTETS = 4

export type ResolveClientIpParams = {
  readonly headers: { get(name: string): string | null }
  /** Peer address of the TCP connection (e.g. `server.requestIP(request)?.address`). */
  readonly socketAddress: string | undefined
  /** The one header the edge/proxy sets itself. `none` (default for hosts not behind a proxy) ignores all of them. */
  readonly trustedHeader: TrustedProxyHeader
}

/**
 * Client address for rate-limit and lockout keys. Only the header the edge sets itself is believed; a copy sent by the
 * client in any other header is ignored. `x-forwarded-for` takes the LAST hop (the one the edge appended), never the
 * first (client-controlled). Only a real address becomes a key, and IPv6 keys on its /64.
 */
export function resolveClientIp(params: ResolveClientIpParams): string {
  const { headers, socketAddress, trustedHeader } = params
  if (trustedHeader === TRUSTED_PROXY_HEADER.X_REAL_IP) {
    const realIp = normalizeAddress(headers.get('x-real-ip'))
    if (realIp) return realIp
  }
  if (trustedHeader === TRUSTED_PROXY_HEADER.X_FORWARDED_FOR) {
    const lastHop = normalizeAddress(headers.get('x-forwarded-for')?.split(',').at(-1))
    if (lastHop) return lastHop
  }
  return normalizeAddress(socketAddress) ?? UNKNOWN_CLIENT_IP
}

// IPv6 keys on its /64: one customer owns the whole block and could otherwise rotate through 2^64 addresses.
function normalizeAddress(raw: string | null | undefined): string | undefined {
  const address = raw?.trim().toLowerCase()
  if (!address) return undefined
  const family = isIP(address)
  if (family === 0) return undefined
  if (family === 4) return address
  if (address.startsWith(MAPPED_IPV4_PREFIX) && isIP(address.slice(MAPPED_IPV4_PREFIX.length)) === 4) {
    return address.slice(MAPPED_IPV4_PREFIX.length)
  }
  return `${expandIpv6(address).slice(0, IPV6_NETWORK_HEXTETS).join(':')}::/64`
}

function expandIpv6(address: string): string[] {
  const [head = '', tail] = address.split('::')
  const headParts = head ? head.split(':') : []
  const tailParts = tail ? tail.split(':') : []
  const missing = tail === undefined ? 0 : IPV6_HEXTETS - headParts.length - tailParts.length
  return [...headParts, ...Array<string>(Math.max(missing, 0)).fill('0'), ...tailParts].map((part) =>
    part.padStart(4, '0'),
  )
}
