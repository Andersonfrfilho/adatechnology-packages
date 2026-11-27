/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'

import { toFetchResponse } from './fetch'

describe('resultado binário', () => {
  it('devolve os bytes como estão, com o Content-Type declarado e os cabeçalhos extras', async () => {
    const bytes = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0xff])
    const response = toFetchResponse(
      {
        kind: 'binary',
        status: 200,
        body: bytes,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        headers: { 'Content-Disposition': 'attachment; filename="leads.xlsx"', 'Content-Type': 'text/plain' },
      },
      new AbortController().signal,
    )
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    )
    expect(response.headers.get('content-disposition')).toContain('leads.xlsx')
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(bytes)
  })
})
