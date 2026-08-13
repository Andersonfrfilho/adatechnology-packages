/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'

import {
  buildEncodeAttempts,
  compressImage,
  PRODUCT_IMAGE_MAX_BYTES,
  resolveCompressedName,
  resolveEncodeType,
  resolveTargetSize,
} from './compressImage'

describe('resolveEncodeType', () => {
  it('converte PNG para WebP, que preserva transparencia e encolhe de verdade', () => {
    expect(resolveEncodeType('image/png')).toBe('image/webp')
  })

  it('mantem JPEG como JPEG, para nao somar uma geracao de perda', () => {
    expect(resolveEncodeType('image/jpeg')).toBe('image/jpeg')
    expect(resolveEncodeType('IMAGE/JPG')).toBe('image/jpeg')
  })

  it('nao tenta recomprimir formato fora da lista fechada da API', () => {
    expect(resolveEncodeType('image/svg+xml')).toBeUndefined()
    expect(resolveEncodeType('image/gif')).toBeUndefined()
  })
})

describe('resolveTargetSize', () => {
  it('reduz pelo maior lado mantendo a proporcao', () => {
    expect(resolveTargetSize({ width: 4000, height: 3000 }, 1600)).toEqual({ width: 1600, height: 1200 })
    expect(resolveTargetSize({ width: 3000, height: 4000 }, 1600)).toEqual({ width: 1200, height: 1600 })
  })

  it('nunca amplia: ampliar inventa pixel e engorda o arquivo', () => {
    expect(resolveTargetSize({ width: 800, height: 600 }, 1600)).toEqual({ width: 800, height: 600 })
  })

  it('nao colapsa lado para zero em imagem muito estreita', () => {
    expect(resolveTargetSize({ width: 4000, height: 3 }, 1600).height).toBe(1)
  })
})

describe('resolveCompressedName', () => {
  it('troca a extensao pela do formato de saida', () => {
    expect(resolveCompressedName('foto-do-produto.HEIC', 'image/webp')).toBe('foto-do-produto.webp')
    expect(resolveCompressedName('sem-extensao', 'image/jpeg')).toBe('sem-extensao.jpg')
  })
})

describe('buildEncodeAttempts', () => {
  it('desce a qualidade antes de encolher de novo, e comeca pela melhor', () => {
    const attempts = buildEncodeAttempts()

    expect(attempts[0]).toEqual({ maxEdge: 1600, quality: 0.86 })
    expect(attempts.at(-1)?.maxEdge).toBeLessThan(1600)

    const edges = attempts.map((attempt) => attempt.maxEdge)
    expect(edges.indexOf(1600)).toBe(0)
    expect(edges.lastIndexOf(1600)).toBeLessThan(edges.indexOf(1024))
  })
})

describe('compressImage', () => {
  function buildFile({ size, type }: { size: number; type: string }): File {
    const file = new File([new Uint8Array(1)], 'produto.jpg', { type })
    Object.defineProperty(file, 'size', { value: size })

    return file
  }

  it('devolve o mesmo arquivo quando ele ja cabe, sem reprocessar', async () => {
    const file = buildFile({ size: PRODUCT_IMAGE_MAX_BYTES, type: 'image/jpeg' })

    expect(await compressImage({ file })).toBe(file)
  })

  it('devolve o original quando o formato nao e recomprimivel', async () => {
    const file = buildFile({ size: PRODUCT_IMAGE_MAX_BYTES + 1, type: 'image/svg+xml' })

    expect(await compressImage({ file })).toBe(file)
  })

  it('devolve o original quando o ambiente nao tem canvas, em vez de lancar', async () => {
    const file = buildFile({ size: PRODUCT_IMAGE_MAX_BYTES + 1, type: 'image/jpeg' })

    expect(await compressImage({ file })).toBe(file)
  })
})
