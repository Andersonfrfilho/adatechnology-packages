/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Trava, por inspeção do fonte (sem DOM, como `accessibility.test.ts`), o que a tela faz com a
 * chave `notification.standard-email`: selo, sem "Remover", "Restaurar padrão" e sem assunto.
 */

import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import en from './locales/en.json'
import ptBR from './locales/pt-BR.json'

const workspace = readFileSync(join(import.meta.dir, 'components/NotificationSettingsWorkspace.tsx'), 'utf8')
const editor = readFileSync(join(import.meta.dir, 'hooks/useTemplateEditor.ts'), 'utf8')

describe('modelo padrão na tela de modelos', () => {
  it('o "Remover" só existe fora da chave padrão (lista e tabela)', () => {
    const removes = workspace.match(/<button[^>]*className="adn-settings__remove"/g) ?? []
    const guards = workspace.match(/isStandardEmailKey\(template\.key\) \?/g) ?? []
    expect(removes).toHaveLength(2)
    expect(guards).toHaveLength(2)
  })

  it('"Restaurar padrão" chama restoreDefault do editor, só na chave padrão', () => {
    expect(workspace).toContain('editor.isStandardEmail && editor.selected')
    expect(workspace).toContain('editor.restoreDefault(editor.selected.id)')
    expect(workspace).toContain("label('settings.restoreDefault')")
    expect(workspace).toContain("label('settings.systemTemplate')")
  })

  it('o campo assunto some na chave padrão e o editor não grava assunto', () => {
    expect(workspace).toContain('editor.isStandardEmail ? (')
    expect(editor).toContain('content.subject && !isStandardEmail')
  })

  it('a validação é a do contracts, e o salvar exige o modelo utilizável', () => {
    expect(editor).toContain('standardAssessment?.usable ?? true')
  })

  it('os textos novos existem nos dois idiomas', () => {
    for (const key of ['settings.systemTemplate', 'settings.restoreDefault', 'settings.standardMissing']) {
      expect((ptBR as Record<string, string>)[key], key).toBeTruthy()
      expect((en as Record<string, string>)[key], key).toBeTruthy()
    }
    for (const rule of ['event', 'placeholder_in_tag', 'scheme', 'tag']) {
      expect((ptBR as Record<string, string>)[`settings.standardUnsafe.${rule}`], rule).toBeTruthy()
    }
  })
})
