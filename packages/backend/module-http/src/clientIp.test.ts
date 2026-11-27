/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'

import { resolveClientIp, type TrustedProxyHeader } from './clientIp'

const SOCKET = '100.64.0.9'
const resolve = (headers: Record<string, string>, trustedHeader: TrustedProxyHeader): string =>
  resolveClientIp({ headers: new Headers(headers), socketAddress: SOCKET, trustedHeader })

describe('client IP behind the edge', () => {
  it('none: forged headers never change the key', () => {
    expect(resolve({ 'x-real-ip': '1.1.1.1', 'x-forwarded-for': '2.2.2.2' }, 'none')).toBe(SOCKET)
  })

  it('x-real-ip: a forged x-forwarded-for does not change the key', () => {
    expect(resolve({ 'x-real-ip': '203.0.113.7', 'x-forwarded-for': '6.6.6.6' }, 'x-real-ip')).toBe('203.0.113.7')
  })

  it('x-forwarded-for: the last hop wins, a forged first hop does not', () => {
    expect(resolve({ 'x-forwarded-for': '6.6.6.6, 203.0.113.7' }, 'x-forwarded-for')).toBe('203.0.113.7')
    expect(
      resolve({ 'x-forwarded-for': '9.9.9.9, 6.6.6.6, 203.0.113.7', 'x-real-ip': '1.1.1.1' }, 'x-forwarded-for'),
    ).toBe('203.0.113.7')
  })

  it('a missing trusted header falls back to the socket, and no socket yields "unknown"', () => {
    expect(resolve({ 'x-forwarded-for': '6.6.6.6' }, 'x-real-ip')).toBe(SOCKET)
    expect(resolveClientIp({ headers: new Headers(), socketAddress: undefined, trustedHeader: 'none' })).toBe('unknown')
  })

  it('a value that is not an address never becomes a key', () => {
    expect(resolve({ 'x-real-ip': 'drop table; --' }, 'x-real-ip')).toBe(SOCKET)
    expect(resolve({ 'x-forwarded-for': '1.1.1.1, <script>' }, 'x-forwarded-for')).toBe(SOCKET)
    expect(resolve({ 'x-real-ip': 'a'.repeat(5000) }, 'x-real-ip')).toBe(SOCKET)
  })

  it('IPv4-mapped IPv6 keys like the IPv4 address', () => {
    expect(resolve({ 'x-real-ip': '::ffff:203.0.113.7' }, 'x-real-ip')).toBe('203.0.113.7')
  })

  it('IPv6 clients share one key per /64', () => {
    const first = resolve({ 'x-real-ip': '2001:db8:abcd:12::1' }, 'x-real-ip')
    expect(first).toBe(resolve({ 'x-real-ip': '2001:0db8:abcd:0012:ffff:ffff:ffff:ffff' }, 'x-real-ip'))
    expect(first).toBe('2001:0db8:abcd:0012::/64')
    expect(resolve({ 'x-real-ip': '2001:db8:abcd:13::1' }, 'x-real-ip')).not.toBe(first)
  })
})
