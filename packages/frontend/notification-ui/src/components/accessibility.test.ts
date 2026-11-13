/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Trava as regras de ícone e acessibilidade (`web.md` §9 e §11) por inspeção do fonte, sem
 * precisar de DOM: renderizar exigiria `@testing-library/react` e um ambiente jsdom que este
 * pacote não tem, e o que se quer garantir é estrutural — ícone decorativo escondido do leitor
 * de tela, botão só-ícone com rótulo, nenhum emoji fazendo papel de ícone.
 */

import { describe, expect, it } from 'bun:test'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const COMPONENTS_DIR = import.meta.dir

function readComponent(name: string): string {
  return readFileSync(join(COMPONENTS_DIR, name), 'utf8')
}

// Arquivo de teste nao e componente: ele PRECISA de literal para montar o caso, e varre-lo faria a
// guarda reprovar o proprio teste que a verifica.
const componentFiles = readdirSync(COMPONENTS_DIR).filter(
  (file) => file.endsWith('.tsx') && !file.endsWith('.test.tsx'),
)

describe('regra de ícones (web.md §9)', () => {
  it('usa a biblioteca de ícones do monorepo, nunca emoji como ícone de UI', () => {
    for (const file of componentFiles) {
      const source = readComponent(file)
      // Emoji renderiza diferente por sistema, não herda currentColor e não escala com o token
      // de tipografia — por isso a regra proíbe em UI de produto.
      const emojiInJsx = /<[^>]*>\s*[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(source)
      expect(emojiInJsx).toBe(false)
    }
  })

  it('todo ícone que acompanha rótulo é decorativo para o leitor de tela', () => {
    for (const file of componentFiles) {
      const source = readComponent(file)
      const iconUsages = source.match(/<(Bell|Check|CheckCheck|Trash2|Inbox|RotateCw|Save)\b[^>]*>/g) ?? []

      for (const usage of iconUsages) {
        // Sem `aria-hidden`, o leitor anuncia o ícone e o rótulo — a mesma ação duas vezes.
        expect(usage).toContain('aria-hidden="true"')
      }
    }
  })

  it('ícone herda currentColor pelo CSS, sem cor literal no componente', () => {
    for (const file of componentFiles) {
      const source = readComponent(file)
      expect(source).not.toMatch(/color=["']#[0-9a-fA-F]{3,8}["']/)
      // Tamanho vem do CSS (`.adn-*-icon`), não de prop mágica no JSX.
      expect(source).not.toMatch(/<(Bell|Check|CheckCheck|Trash2|Inbox|RotateCw|Save)\b[^>]*\bsize=\{?\d/)
    }
  })
})

describe('acessibilidade', () => {
  it('botão só-ícone declara aria-label', () => {
    const bell = readComponent('NotificationBell.tsx')
    const item = readComponent('NotificationItem.tsx')

    expect(bell).toContain('aria-label={accessibleLabel}')
    expect(item).toContain("aria-label={messages['item.markAsRead']}")
    expect(item).toContain("aria-label={messages['item.delete']}")
  })

  it('a linha clicável é <button>, não <div> com onClick', () => {
    const item = readComponent('NotificationItem.tsx')

    // `div` com onClick não recebe foco nem responde a Enter/Espaço.
    expect(item).not.toMatch(/<div[^>]*onClick/)
    expect(item).toContain('<button type="button" className="adn-item__main"')
  })

  it('contador de não lidas anuncia mudança sem interromper a leitura', () => {
    expect(readComponent('NotificationBell.tsx')).toContain('aria-live="polite"')
  })

  it('feedback de salvar usa role status, e o de erro usa role alert', () => {
    const panel = readComponent('PreferencesPanel.tsx')

    expect(panel).toContain('role="status"')
    expect(panel).toContain('role="alert"')
  })
})

describe('internacionalização (web.md §6)', () => {
  it('nenhum texto visível hardcoded em tag ou prop', () => {
    for (const file of componentFiles) {
      const source = readComponent(file)
      // Texto solto entre tags, ignorando expressões `{...}` e tags de fechamento.
      const hardcodedText = source.match(/>\s*[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ ]{3,}\s*</g) ?? []
      expect(hardcodedText).toEqual([])
    }
  })
})

describe('responsividade (web.md §10)', () => {
  const styles = readFileSync(join(COMPONENTS_DIR, '..', 'styles.css'), 'utf8')

  it('é mobile-first — só `min-width`, nunca `max-width` para remover', () => {
    expect(styles).toContain('@media (min-width:')
    expect(styles).not.toContain('@media (max-width:')
  })

  it('respeita o alvo mínimo de toque de 44px', () => {
    expect(styles).toContain('--adn-touch-target: 44px')
    expect(styles).toContain('min-height: var(--adn-touch-target)')
  })

  it('não tem cor de produto embutida — só custom property com fallback neutro', () => {
    // Todo hexadecimal precisa estar dentro de `var(--adn-*, #fallback)` ou ser branco/preto puro
    // de contraste; cor de marca vem do host.
    const hexOutsideVar = styles.match(/#[0-9a-fA-F]{3,8}/g)?.filter((hex) => {
      const index = styles.indexOf(hex)
      const context = styles.slice(Math.max(0, index - 60), index)
      return !context.includes('var(--adn-') && hex !== '#ffffff'
    })

    expect(hexOutsideVar ?? []).toEqual([])
  })
})
