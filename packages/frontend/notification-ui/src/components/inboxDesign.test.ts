/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * O desenho da caixa de entrada, travado por inspeção de fonte — o pacote não tem jsdom, e o que se
 * quer garantir aqui é estrutural.
 *
 * Cada item existe por um defeito visto na tela do primeiro consumidor:
 *
 * 1. **Três títulos iguais.** A página do produto escrevia "Notificações", o workspace escrevia
 *    "Notificações" no `<h1>` dele, e a lista escrevia "Notificações" no `<h2>` — a mesma palavra
 *    três vezes em 200px de altura, e nenhuma delas dizendo qual é a diferença entre as regiões.
 * 2. **Dois `<h1>` na mesma página.** O workspace desenha o cabeçalho dele dentro de uma página que
 *    já tem o próprio. Para leitor de tela, duas primeiras manchetes é o mesmo que nenhuma.
 * 3. **O vazio que aparecia cheio.** `renderEmpty` era chamado ao lado da lista, sem condição: o
 *    texto "Nada por aqui ainda…" ficava embaixo das notificações que estavam ali.
 * 4. **Linha sem horário.** Título e corpo e mais nada — a ordem da lista virava afirmação sem prova.
 */

import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const COMPONENTS_DIR = import.meta.dir
const SOURCE_DIR = join(COMPONENTS_DIR, '..')

function readSource(relativePath: string): string {
  return readFileSync(join(SOURCE_DIR, relativePath), 'utf8')
}

function readLocale(name: string): Record<string, string> {
  return JSON.parse(readSource(join('locales', name))) as Record<string, string>
}

/** O bloco de uma regra CSS, do seletor até a chave que o fecha. */
function cssRule(styles: string, selector: string): string {
  const start = styles.indexOf(`${selector} {`)
  if (start === -1) throw new Error(`styles.css não tem a regra "${selector}"`)

  const end = styles.indexOf('}', start)
  return styles.slice(start, end)
}

describe('vocabulário: cada região diz o que ela é', () => {
  const locales = { 'pt-BR': readLocale('pt-BR.json'), en: readLocale('en.json') }

  it('os dois locales têm exatamente as mesmas chaves', () => {
    // Chave que existe num locale e falta no outro não falha: mostra a chave crua na tela.
    expect(Object.keys(locales.en).sort()).toEqual(Object.keys(locales['pt-BR']).sort())
  })

  it('a tela e a lista dentro dela não dizem a mesma palavra', () => {
    // O sino fica de fora de propósito: `bell.label` é o nome acessível de um botão que vive no
    // cabeçalho da aplicação, longe daqui, e "Notificações" é exatamente o que ele faz. O defeito
    // era outro — dois títulos VISÍVEIS, um dentro do outro, repetindo a palavra.
    for (const [locale, messages] of Object.entries(locales)) {
      expect(messages['list.title'], `${locale} repete o título da tela na lista`).not.toBe(messages['workspace.title'])
    }
  })
})

describe('cabeçalho: um `<h1>` por página', () => {
  it('os dois workspaces aceitam o cabeçalho do produto no lugar do padrão', () => {
    for (const name of ['NotificationsWorkspace', 'NotificationSettingsWorkspace']) {
      const source = readSource(join('components', `${name}.tsx`))

      expect(source, `${name} sem renderHeader`).toContain('renderHeader?: () => ReactNode')
      // Ausente, o padrão continua desenhando — slot é substituição, não interruptor. O espaço em
      // branco é colapsado porque quem formata este arquivo é o prettier, não o teste.
      expect(source.replace(/\s+/g, ' '), `${name} não usa renderHeader`).toContain(
        '{renderHeader ? ( renderHeader() ) : (',
      )
    }
  })
})

describe('vazio: quem decide é a lista, que sabe se está vazia', () => {
  it('o workspace repassa `renderEmpty` para a lista em vez de desenhar ao lado dela', () => {
    const workspace = readSource(join('components', 'NotificationsWorkspace.tsx'))

    expect(workspace).not.toContain('{renderEmpty?.()}')
    expect(workspace).toContain('renderEmpty')
    expect(workspace).toContain('<NotificationList')
  })

  it('a lista aceita o vazio do produto e só o mostra quando não há nada', () => {
    const list = readSource(join('components', 'NotificationList.tsx'))

    expect(list).toContain('renderEmpty?: () => ReactNode')
    expect(list).toContain('renderEmpty?.() ?? (')
  })
})

describe('linha: quando o aviso chegou', () => {
  it('o item marca o instante em `<time>` legível por máquina', () => {
    const item = readSource(join('components', 'NotificationItem.tsx'))

    expect(item).toContain('<time')
    expect(item).toContain('dateTime={notification.createdAt}')
    // O relativo esconde a hora exata; o `title` a devolve a quem parar o mouse.
    expect(item).toContain('formatNotificationTimestamp')
  })

  it('o formato acompanha o locale do provider, não um fixo do pacote', () => {
    expect(readSource('NotificationProvider.tsx')).toContain('readonly locale: NotificationLocale')
    expect(readSource(join('components', 'NotificationItem.tsx'))).toContain('locale')
  })
})

describe('estilo', () => {
  const styles = readSource('styles.css')

  it('a inbox é um cartão, com a mesma borda dos painéis de configuração', () => {
    // Sem borda, a lista flutuava sobre o fundo do host e o cabeçalho dela parecia da página.
    expect(cssRule(styles, '.adn-list')).toContain('border: 1px solid var(--adn-color-border)')
  })

  it('o horário tem estilo próprio, discreto', () => {
    expect(cssRule(styles, '.adn-item__time')).toContain('var(--adn-color-muted)')
  })

  it('o esqueleto de carregamento respeita quem pediu menos movimento', () => {
    expect(styles).toContain('.adn-list__skeleton')
    expect(styles).toContain('@media (prefers-reduced-motion: reduce)')
  })
})
