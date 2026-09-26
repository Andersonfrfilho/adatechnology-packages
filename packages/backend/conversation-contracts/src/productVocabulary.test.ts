/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * ADR-0085 §2: o núcleo nunca aprende o domínio do produto. Cada envio, cada
 * transportadora, cada motorista chega como par opaco — nome, valor, nada mais.
 * Este contrato reprova se algum arquivo do núcleo usar palavras de produto.
 */

import { describe, expect, it } from 'bun:test'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

describe('productVocabulary: núcleo rejeita vocabulário de produto', () => {
  // Construir as palavras sem literais para passar na varredura própria
  const forbiddenWords = ['occ' + 'urrence', 'contr' + 'actor', 'dri' + 'ver']
  const forbiddenPattern = new RegExp(forbiddenWords.join('|'), 'i')

  function scanDirectory(dirPath: string): Array<{ file: string; lineNumber: number; content: string }> {
    const findings: Array<{ file: string; lineNumber: number; content: string }> = []
    const files = readdirSync(dirPath)
      .filter((f) => f.endsWith('.ts'))
      .sort()

    for (const file of files) {
      const filePath = join(dirPath, file)
      const content = readFileSync(filePath, 'utf-8')
      const lines = content.split('\n')

      for (let i = 0; i < lines.length; i++) {
        if (forbiddenPattern.test(lines[i])) {
          findings.push({
            file,
            lineNumber: i + 1,
            content: lines[i].trim(),
          })
        }
      }
    }

    return findings
  }

  it('nenhum arquivo do núcleo contém vocabulário de produto', () => {
    // @ts-expect-error: import.meta.dir is a Bun-specific feature
    const srcDir = import.meta.dir as string
    const findings = scanDirectory(srcDir)

    const fileDiagnostics = findings.map((f) => `  ${f.file}:${f.lineNumber}: ${f.content}`).join('\n')

    if (findings.length > 0) {
      console.error(`Violação do contrato:\n${fileDiagnostics}`)
    }

    expect(findings).toEqual([])
  })

  it('detector funciona: encontra vocabulário em string sintética', () => {
    const testWord = 'occ' + 'urrence'
    const syntheticString = `This string contains ${testWord} as an example`
    const found = forbiddenPattern.test(syntheticString)
    expect(found).toBe(true)
  })

  it('varredura encontrou os arquivos conhecidos', () => {
    // @ts-expect-error: import.meta.dir is a Bun-specific feature
    const srcDir = import.meta.dir as string
    const files = readdirSync(srcDir)
      .filter((f) => f.endsWith('.ts'))
      .sort()

    const knownFiles = ['channelCapabilities.ts', 'deliveryStatus.ts', 'index.ts', 'ports.ts', 'vocabulary.ts']
    for (const known of knownFiles) {
      expect(files).toContain(known)
    }
  })
})
