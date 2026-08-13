/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'

import { PRODUCT_IMAGE } from '../shared/productImage.constant'
import type { CatalogDependencies } from './catalogModule.types'
import { UploadProductImageUseCase } from './UploadProductImage.use-case'

type UploadCall = { buffer: Buffer; mimeType: string; key: string }

function buildUseCase(options: { withStorage: boolean } = { withStorage: true }): {
  useCase: UploadProductImageUseCase
  calls: UploadCall[]
} {
  const calls: UploadCall[] = []
  const imageStorage = {
    async upload(params: UploadCall) {
      calls.push(params)
      return { url: `https://cdn.example/${params.key}`, key: params.key }
    },
  }

  const dependencies = {
    ...(options.withStorage ? { imageStorage } : {}),
  } as unknown as CatalogDependencies

  return { useCase: new UploadProductImageUseCase(dependencies), calls }
}

const COMPANY_ID = 'company-1'
const PNG = new Uint8Array([137, 80, 78, 71])

describe('UploadProductImageUseCase', () => {
  it('guarda a imagem sob uma chave da empresa e devolve a URL publicada', async () => {
    const { useCase, calls } = buildUseCase()

    const result = await useCase.execute({ companyId: COMPANY_ID, bytes: PNG, mimeType: 'image/png' })

    expect(calls).toHaveLength(1)
    expect(calls[0]?.key).toStartWith(`${PRODUCT_IMAGE.KEY_PREFIX}/${COMPANY_ID}/`)
    expect(calls[0]?.key).toEndWith('.png')
    expect(result.url).toBe(`https://cdn.example/${calls[0]?.key}`)
  })

  it('aceita content-type com parametro e caixa alta', async () => {
    const { useCase, calls } = buildUseCase()

    await useCase.execute({ companyId: COMPANY_ID, bytes: PNG, mimeType: 'IMAGE/JPEG; charset=binary' })

    expect(calls[0]?.mimeType).toBe('image/jpeg')
    expect(calls[0]?.key).toEndWith('.jpg')
  })

  it('nao deixa a chave carregar nada digitado pelo usuario', async () => {
    const { useCase, calls } = buildUseCase()

    await useCase.execute({ companyId: COMPANY_ID, bytes: PNG, mimeType: 'image/webp' })

    // Duas chamadas seguidas com o mesmo conteúdo produzem chaves diferentes: o nome vem de UUID.
    await useCase.execute({ companyId: COMPANY_ID, bytes: PNG, mimeType: 'image/webp' })
    expect(calls[0]?.key).not.toBe(calls[1]?.key)
  })

  it('recusa formato fora da lista fechada, inclusive svg', async () => {
    const { useCase, calls } = buildUseCase()

    await expect(useCase.execute({ companyId: COMPANY_ID, bytes: PNG, mimeType: 'image/svg+xml' })).rejects.toThrow()
    expect(calls).toHaveLength(0)
  })

  it('recusa corpo vazio e corpo acima do teto', async () => {
    const { useCase, calls } = buildUseCase()

    await expect(
      useCase.execute({ companyId: COMPANY_ID, bytes: new Uint8Array(), mimeType: 'image/png' }),
    ).rejects.toThrow()

    await expect(
      useCase.execute({
        companyId: COMPANY_ID,
        bytes: new Uint8Array(PRODUCT_IMAGE.MAX_BYTES + 1),
        mimeType: 'image/png',
      }),
    ).rejects.toThrow()

    expect(calls).toHaveLength(0)
  })

  it('sem porta de storage, falha em vez de fingir que guardou', async () => {
    const { useCase } = buildUseCase({ withStorage: false })

    await expect(useCase.execute({ companyId: COMPANY_ID, bytes: PNG, mimeType: 'image/png' })).rejects.toThrow()
  })
})
