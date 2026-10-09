import { describe, expect, it } from 'bun:test'

import { show } from './participantMessageFormat.test-helper'
import { isAllowedLinkHref } from './participantMessageLinks'
import { parseInline } from './participantMessageInline'

function inline(line: string): string {
  return show(parseInline(line))
}

describe('isAllowedLinkHref', () => {
  it('accepts only http, https, mailto and tel', () => {
    expect(isAllowedLinkHref('http://a.com')).toBe(true)
    expect(isAllowedLinkHref('https://a.com/x?y=1')).toBe(true)
    expect(isAllowedLinkHref('HTTPS://A.COM')).toBe(true)
    expect(isAllowedLinkHref('mailto:a@b.co')).toBe(true)
    expect(isAllowedLinkHref('tel:+5511987654321')).toBe(true)
  })

  it('rejects every other protocol and non-URLs', () => {
    expect(isAllowedLinkHref('javascript:alert(1)')).toBe(false)
    expect(isAllowedLinkHref(' javascript:alert(1)')).toBe(false)
    expect(isAllowedLinkHref('JaVaScRiPt:alert(1)')).toBe(false)
    expect(isAllowedLinkHref('data:text/html,<b>x</b>')).toBe(false)
    expect(isAllowedLinkHref('vbscript:x')).toBe(false)
    expect(isAllowedLinkHref('file:///etc/passwd')).toBe(false)
    expect(isAllowedLinkHref('ftp://a.com')).toBe(false)
    expect(isAllowedLinkHref('//a.com')).toBe(false)
    expect(isAllowedLinkHref('/relativo')).toBe(false)
    expect(isAllowedLinkHref('')).toBe(false)
  })
})

describe('autolink - http and https', () => {
  it('links plain URLs and keeps the literal as the label', () => {
    expect(inline('veja https://a.com/x agora')).toBe('veja ⟦l:https://a.com/x→https://a.com/x⟧ agora')
    expect(inline('http://a.com')).toBe('⟦l:http://a.com→http://a.com⟧')
  })

  it('keeps trailing punctuation outside the link', () => {
    expect(inline('https://a.com.')).toBe('⟦l:https://a.com→https://a.com⟧.')
    expect(inline('https://a.com,')).toBe('⟦l:https://a.com→https://a.com⟧,')
    expect(inline('https://a.com;')).toBe('⟦l:https://a.com→https://a.com⟧;')
    expect(inline('https://a.com:')).toBe('⟦l:https://a.com→https://a.com⟧:')
    expect(inline('https://a.com!')).toBe('⟦l:https://a.com→https://a.com⟧!')
    expect(inline('https://a.com?')).toBe('⟦l:https://a.com→https://a.com⟧?')
    expect(inline('https://a.com/x...')).toBe('⟦l:https://a.com/x→https://a.com/x⟧...')
  })

  it('keeps balanced parentheses inside and drops the unbalanced one', () => {
    expect(inline('(veja https://a.com/p)')).toBe('(veja ⟦l:https://a.com/p→https://a.com/p⟧)')
    expect(inline('https://a.com/p_(x)')).toBe('⟦l:https://a.com/p_(x)→https://a.com/p_(x)⟧')
    expect(inline('(https://a.com/p_(x))')).toBe('(⟦l:https://a.com/p_(x)→https://a.com/p_(x)⟧)')
  })

  it('keeps query strings and ampersands', () => {
    expect(inline('https://a.com/?a=1&b=2')).toBe('⟦l:https://a.com/?a=1&b=2→https://a.com/?a=1&b=2⟧')
  })

  it('accepts an uppercase scheme, normalising only the scheme of the href', () => {
    expect(inline('HTTP://MAIUSCULO')).toBe('⟦l:HTTP://MAIUSCULO→http://MAIUSCULO⟧')
  })

  it('does not format marks inside a URL, but a mark may wrap it', () => {
    expect(inline('https://a.com/_x_/~y~/*z*')).toBe('⟦l:https://a.com/_x_/~y~/*z→https://a.com/_x_/~y~/*z⟧*')
    expect(inline('*https://a.com*')).toBe('⟦s:⟦l:https://a.com→https://a.com⟧⟧')
  })

  it('does not link a scheme with nothing after it, nor inside code', () => {
    expect(inline('https://')).toBe('https://')
    expect(inline('`https://a.com`')).toBe('⟦c:https://a.com⟧')
  })
})

describe('autolink - unsafe protocols stay text', () => {
  it('never links javascript, data or vbscript', () => {
    expect(inline('javascript:alert(1)')).toBe('javascript:alert(1)')
    expect(inline('data:text/html,<script>alert(1)</script>')).toBe('data:text/html,<script>alert(1)</script>')
    expect(inline('vbscript:msgbox(1)')).toBe('vbscript:msgbox(1)')
    expect(inline('clique: javascript://%0aalert(1)')).toBe('clique: javascript://%0aalert(1)')
  })
})

describe('autolink - cost and userinfo', () => {
  it('trims a long run of closing parentheses in linear time', () => {
    const started = performance.now()
    inline(`https://a${')'.repeat(7990)}`)
    expect(performance.now() - started).toBeLessThan(20)
  })

  it('still balances parentheses', () => {
    expect(inline('https://a.com/x_(y))')).toBe('⟦l:https://a.com/x_(y)→https://a.com/x_(y)⟧)')
  })

  it('leaves a link with credentials as text', () => {
    expect(isAllowedLinkHref('https://user:pass@a.com')).toBe(false)
    expect(isAllowedLinkHref('https://user@a.com')).toBe(false)
    expect(inline('https://user:pass@a.com/x')).not.toContain('⟦l:')
  })
})
