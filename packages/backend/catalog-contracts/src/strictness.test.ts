/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * O README deste pacote afirma três invariantes. Afirmação sem teste é comentário: alguém
 * adiciona um campo, o texto continua lá, e o contrato passou a mentir. Aqui elas viram falha
 * de build.
 *
 * 1. `companyId` nunca entra por corpo de requisição
 * 2. Dinheiro é centavo inteiro
 * 3. O pacote não depende de nada da Meta em runtime
 */

import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  bulkImportRowSchema,
  createCatalogSchema,
  createProductSchema,
  createSectionSchema,
  listProductsQuerySchema,
  updateProductSchema,
} from './schemas'

const BODY_SCHEMAS = {
  createProduct: createProductSchema,
  updateProduct: updateProductSchema,
  createCatalog: createCatalogSchema,
  createSection: createSectionSchema,
} as const

describe('companyId não atravessa a fronteira', () => {
  for (const [name, schema] of Object.entries(BODY_SCHEMAS)) {
    it(`${name} descarta companyId enviado pelo cliente`, () => {
      const parsed = schema.parse({ name: 'Item', priceInCents: 100, companyId: 'empresa-de-outro' })

      // Zod remove chave desconhecida em vez de rejeitar. O efeito é o que importa: o valor
      // não chega ao use-case, então não há como escolher a empresa alheia pelo corpo.
      expect('companyId' in parsed).toBe(false)
    })
  }

  it('nenhum schema de corpo declara companyId — nem opcional', () => {
    for (const [name, schema] of Object.entries(BODY_SCHEMAS)) {
      expect(Object.keys(schema.shape), name).not.toContain('companyId')
    }
  })
})

describe('dinheiro é centavo inteiro', () => {
  it('rejeita 19.99 — o erro que transformaria vinte reais em vinte centavos', () => {
    const result = createProductSchema.safeParse({ name: 'Café', priceInCents: 19.99 })

    expect(result.success).toBe(false)
  })

  it('rejeita preço negativo', () => {
    expect(createProductSchema.safeParse({ name: 'Café', priceInCents: -1 }).success).toBe(false)
  })

  it('aceita zero — brinde e item de cortesia existem', () => {
    expect(createProductSchema.safeParse({ name: 'Sacola', priceInCents: 0 }).success).toBe(true)
  })

  it('custo segue a mesma regra do preço', () => {
    const result = createProductSchema.safeParse({ name: 'Café', priceInCents: 2490, costPriceInCents: 12.5 })

    expect(result.success).toBe(false)
  })

  it('a importação em lote aceita string porque planilha exporta "19,90"', () => {
    // A exceção é deliberada e local: converter aqui exigiria saber a moeda, que o use-case sabe.
    expect(bulkImportRowSchema.safeParse({ name: 'Café', price: '19,90' }).success).toBe(true)
    expect(bulkImportRowSchema.safeParse({ name: 'Café', price: 1990 }).success).toBe(true)
  })
})

describe('query string chega como texto', () => {
  it('coage página e tamanho, e aplica os defaults', () => {
    const parsed = listProductsQuerySchema.parse({ page: '3' })

    expect(parsed).toMatchObject({ page: 3, pageSize: 20 })
  })

  it('trava pageSize no teto — sem isso, ?pageSize=999999 vira varredura de tabela', () => {
    expect(listProductsQuerySchema.safeParse({ pageSize: '101' }).success).toBe(false)
  })

  it('booleano vem por literal, não por truthiness: "false" é false', () => {
    expect(listProductsQuerySchema.parse({ active: 'false' }).active).toBe(false)
    expect(listProductsQuerySchema.parse({ active: 'true' }).active).toBe(true)
  })

  it('rejeita valor que não é o literal, em vez de virar true silenciosamente', () => {
    expect(listProductsQuerySchema.safeParse({ active: '1' }).success).toBe(false)
  })
})

describe('código de barras', () => {
  it.each([
    ['GTIN-8', '12345678', true],
    ['GTIN-13', '7891234567895', true],
    ['GTIN-14', '17891234567892', true],
    ['9 dígitos — não é formato GTIN', '123456789', false],
    ['com letra', '789123456789X', false],
  ])('%s', (_label, value, expected) => {
    expect(createProductSchema.safeParse({ name: 'Item', priceInCents: 100, barcode: value }).success).toBe(expected)
  })
})

describe('acoplamento', () => {
  it('zod é a única dependência de runtime', () => {
    const manifest = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf8'))

    expect(Object.keys(manifest.dependencies ?? {})).toEqual(['zod'])
  })

  it('a porta da Meta existe como tipo, sem trazer cliente de Graph API junto', () => {
    // É o que permite o pacote se chamar `catalog-*`: quem só gerencia catálogo interno
    // instala isto e não carrega nada da Meta.
    const providers = readFileSync(join(__dirname, 'providers.ts'), 'utf8')

    expect(providers).toContain('MetaCatalogSyncPort')
    expect(providers).not.toMatch(/^import .*from ['"](?!\.)/m)
  })
})
