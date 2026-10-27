/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * O pacote nao depende do `catalog-contracts` em runtime — de proposito: o provider nao deve
 * conhecer o modulo que o consome. Mas se a forma dos dois andar separada, a incompatibilidade so
 * aparece no host, na integracao, e o erro aponta para o lugar errado.
 *
 * Aqui o contracts entra como dependencia **de desenvolvimento**, e o encaixe vira erro de
 * compilacao neste pacote.
 */

import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import type { ProductVisionPort } from '@adatechnology/catalog-contracts'

import { createBarcodeReader } from './barcode/barcode-reader.service'
import { createClipEmbedder } from './clip-local/clip-embedder.service'
import { createVisionChain } from './vision-chain.service'

describe('o que este pacote produz satisfaz a porta que o catalog-module exige', () => {
  it('a cadeia completa e uma ProductVisionPort', () => {
    const port: ProductVisionPort = createVisionChain([
      createBarcodeReader(),
      createClipEmbedder({}, { loadExtractor: async () => async () => ({ data: new Float32Array(512) }) }),
    ])

    expect(port.embeddingModel?.dimensions).toBe(512)
  })

  it('a cadeia so de codigo de barras tambem e, e sem modelo declarado', () => {
    const port: ProductVisionPort = createBarcodeReader()

    // E o que o catalog-module le para nao subir indice vetorial nem exigir a migration do pgvector.
    expect(port.embeddingModel).toBeUndefined()
  })

  it('a dimensao declarada e a que o indice do catalog-module comporta', () => {
    const port: ProductVisionPort = createClipEmbedder()

    // 512 e o valor fixo da coluna `vector(512)` de la; divergir derruba o boot do host.
    expect(port.embeddingModel).toEqual({ id: 'Xenova/clip-vit-base-patch32', dimensions: 512 })
  })
})

describe('acoplamento', () => {
  it('a raiz do pacote nao importa engine nenhum', () => {
    // O README promete que quem so le codigo de barras nao baixa runtime de ONNX. A promessa vive
    // no `index.ts`: um `export` a mais aqui arrasta os dois engines para dentro do bundle raiz.
    const index = readFileSync(join(__dirname, 'index.ts'), 'utf8')
    // So as linhas de modulo: a mencao aos subpaths no comentario do cabecalho e documentacao,
    // nao acoplamento.
    const moduleLines = index.split('\n').filter((line) => /^\s*(import|export)\b.*\bfrom\b/.test(line))

    expect(moduleLines.join('\n')).not.toContain('./barcode')
    expect(moduleLines.join('\n')).not.toContain('./clip-local')
    expect(moduleLines.length).toBeGreaterThan(0)
  })

  it('nenhuma dependencia de runtime', () => {
    const manifest = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf8'))

    // Os engines pedem `peerDependencies` opcionais; `dependencies` vazio e o que garante que
    // instalar este pacote nao arrasta nada.
    expect(manifest.dependencies ?? {}).toEqual({})
    expect(Object.keys(manifest.peerDependenciesMeta).sort()).toEqual([
      '@huggingface/transformers',
      '@undecaf/zbar-wasm',
    ])
  })
})
