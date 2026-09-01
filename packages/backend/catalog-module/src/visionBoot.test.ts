/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * O indice tem coluna de tamanho fixo e nao enxerga qual modelo gerou cada vetor. As duas guardas
 * abaixo sao o que impede uma troca de provider de envenenar a busca em silencio.
 */

import { describe, expect, it } from 'bun:test'

import type { ProductVisionPort } from '@adatechnology/catalog-contracts'

import { createCatalogModule } from './CatalogModule'
import type { CatalogDatabase } from './database.types'
import { PRODUCT_EMBEDDING_DIMENSIONS } from './schema/vision.schema'

const db = {} as unknown as CatalogDatabase
const config = { currency: 'BRL', locale: 'pt-BR' }

function visionWith(dimensions: number, id = 'clip-vit-b32'): ProductVisionPort {
  return { name: 'teste', embeddingModel: { id, dimensions }, read: async () => ({ engine: 'teste' }) }
}

describe('dimensao do vetor, no boot', () => {
  it('provider na dimensao do indice sobe', () => {
    const catalog = createCatalogModule({ db, config, providers: { vision: visionWith(PRODUCT_EMBEDDING_DIMENSIONS) } })

    expect(catalog.hasVision).toBe(true)
  })

  it('provider de outra dimensao derruba a composicao', () => {
    // 768 e o SigLIP base. Sem esta guarda o `INSERT` recusaria — mas so na primeira foto, no meio
    // de uma conversa, em vez de no startup.
    expect(() => createCatalogModule({ db, config, providers: { vision: visionWith(768) } })).toThrow(
      'O provider de visao gera vetor de dimensao incompativel com o indice deste modulo.',
    )
  })

  it('provider so de codigo de barras nao tem dimensao a validar', () => {
    const barcodeOnly: ProductVisionPort = { name: 'zbar', read: async () => ({ barcode: '789', engine: 'zbar' }) }

    const catalog = createCatalogModule({ db, config, providers: { vision: barcodeOnly } })

    expect(catalog.hasVision).toBe(true)
    expect(catalog.verifyVisionIndex).toBeUndefined()
  })

  it('sem visao, nao ha o que verificar', () => {
    const catalog = createCatalogModule({ db, config })

    expect(catalog.hasVision).toBe(false)
    expect(catalog.verifyVisionIndex).toBeUndefined()
  })
})

describe('modelo que construiu o indice', () => {
  it('indice vazio nao e divergencia', async () => {
    const catalog = createCatalogModule({
      db: { selectDistinct: () => ({ from: () => ({ where: async () => [] }) }) } as unknown as CatalogDatabase,
      config,
      providers: { vision: visionWith(PRODUCT_EMBEDDING_DIMENSIONS) },
    })

    // Sem esta linha o teste passaria vacuamente: `?.` sobre um metodo ausente resolve
    // `undefined`, que e exatamente o que o assert espera.
    expect(catalog.verifyVisionIndex).toBeDefined()
    await expect(catalog.verifyVisionIndex?.({ companyId: 'empresa-1' })).resolves.toBeUndefined()
  })

  it('modelo estranho no indice derruba, nomeando qual reindexar', async () => {
    const catalog = createCatalogModule({
      db: {
        selectDistinct: () => ({ from: () => ({ where: async () => [{ model: 'siglip-base' }] }) }),
      } as unknown as CatalogDatabase,
      config,
      providers: { vision: visionWith(PRODUCT_EMBEDDING_DIMENSIONS, 'clip-vit-b32') },
    })

    await expect(catalog.verifyVisionIndex?.({ companyId: 'empresa-1' })).rejects.toThrow(
      'O modelo de embedding do provider difere do que indexou o catálogo; reindexe antes de usar.',
    )
  })

  it('indice do mesmo modelo passa', async () => {
    const catalog = createCatalogModule({
      db: {
        selectDistinct: () => ({ from: () => ({ where: async () => [{ model: 'clip-vit-b32' }] }) }),
      } as unknown as CatalogDatabase,
      config,
      providers: { vision: visionWith(PRODUCT_EMBEDDING_DIMENSIONS, 'clip-vit-b32') },
    })

    expect(catalog.verifyVisionIndex).toBeDefined()
    await expect(catalog.verifyVisionIndex?.({ companyId: 'empresa-1' })).resolves.toBeUndefined()
  })
})
