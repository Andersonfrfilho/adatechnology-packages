import { describe, expect, it } from 'bun:test'

import { isSafeAttachmentUrl } from './participantAttachmentUrl'

describe('isSafeAttachmentUrl', () => {
  it('accepts https, http and blob', () => {
    expect(isSafeAttachmentUrl('https://cdn.example.com/a.png?sig=1')).toBe(true)
    expect(isSafeAttachmentUrl('http://localhost:3000/a.png')).toBe(true)
    expect(isSafeAttachmentUrl('blob:https://app.example.com/0b1c')).toBe(true)
  })

  it('rejects script and data schemes in any casing or with surrounding whitespace', () => {
    expect(isSafeAttachmentUrl('javascript:alert(1)')).toBe(false)
    expect(isSafeAttachmentUrl('JaVaScRiPt:alert(1)')).toBe(false)
    expect(isSafeAttachmentUrl('  javascript:alert(1)')).toBe(false)
    expect(isSafeAttachmentUrl('java\tscript:alert(1)')).toBe(false)
    expect(isSafeAttachmentUrl('data:text/html,<script>alert(1)</script>')).toBe(false)
    expect(isSafeAttachmentUrl('vbscript:msgbox(1)')).toBe(false)
  })

  it('accepts a safe scheme in mixed case and with surrounding whitespace', () => {
    expect(isSafeAttachmentUrl(' HTTPS://cdn.example.com/a.png ')).toBe(true)
  })

  it('rejects empty and relative urls', () => {
    expect(isSafeAttachmentUrl('')).toBe(false)
    expect(isSafeAttachmentUrl('   ')).toBe(false)
    expect(isSafeAttachmentUrl('/files/a.png')).toBe(false)
    expect(isSafeAttachmentUrl('a.png')).toBe(false)
    expect(isSafeAttachmentUrl('//evil.example.com/a.png')).toBe(false)
  })
})
