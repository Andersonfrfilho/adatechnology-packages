/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * ADR-0085 §2, CA01: o núcleo nunca aprende o domínio do produto — o assunto chega como par opaco.
 * Este contrato varre `src/` inteiro, subpastas incluídas, e reprova se aparecer palavra de produto.
 * As palavras são montadas em runtime para o próprio arquivo passar pela varredura.
 */

import { describe, expect, it } from 'bun:test'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const FORBIDDEN_PATTERN = new RegExp(['occ' + 'urrence', 'contr' + 'actor', 'dri' + 'ver'].join('|'), 'i')
const SOURCE_DIRECTORY = __dirname

type Finding = { readonly file: string; readonly lineNumber: number; readonly content: string }

function listSourceFiles(directory: string): string[] {
  return readdirSync(directory)
    .sort()
    .flatMap((entry) => {
      const path = join(directory, entry)
      if (statSync(path).isDirectory()) return listSourceFiles(path)
      return path.endsWith('.ts') ? [path] : []
    })
}

function scanText(file: string, text: string): Finding[] {
  return text
    .split('\n')
    .flatMap((line, index) =>
      FORBIDDEN_PATTERN.test(line) ? [{ file, lineNumber: index + 1, content: line.trim() }] : [],
    )
}

describe('o núcleo não carrega vocabulário de produto (CA01)', () => {
  it('nenhum arquivo de src/ contém palavra de produto', () => {
    const findings = listSourceFiles(SOURCE_DIRECTORY).flatMap((path) =>
      scanText(relative(SOURCE_DIRECTORY, path), readFileSync(path, 'utf-8')),
    )
    expect(findings).toEqual([])
  })

  it('o detector acha a palavra quando ela aparece', () => {
    expect(scanText('sintetico.ts', `const kind = '${'occ' + 'urrence'}'`)).toHaveLength(1)
  })

  it('a varredura passou pelos arquivos conhecidos', () => {
    const files = listSourceFiles(SOURCE_DIRECTORY).map((path) => relative(SOURCE_DIRECTORY, path))
    for (const known of ['index.ts', 'schema/schema.ts', 'runMigrations.ts']) {
      expect(files).toContain(known)
    }
  })
})
