/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * O ÚNICO teste deste pacote que olha o `dist`, e existe porque a ausência dele deixou passar um
 * pacote publicado que não renderizava.
 *
 * O `notification-ui@0.1.0-rc.1` foi ao registry emitindo `React.createElement` do runtime clássico
 * de JSX sem importar o `React` — todo consumidor levava `ReferenceError: React is not defined` no
 * primeiro render do `NotificationProvider`. Os 19 testes seguiam verdes, e seguiriam: eles
 * importam o FONTE, que o transpilador do bun compila com o runtime automático. O artefato
 * publicado ninguém olhava.
 *
 * A causa foi `jsx: react-jsx` chegando por `extends` do `tsconfig.base.json`: o esbuild lê a opção
 * do tsconfig do pacote, mas **não segue `extends`** para resolvê-la. `tsc` e `bun test`
 * concordavam, o build discordava em silêncio.
 *
 * Testar o dist é feio e é o certo aqui: o que o consumidor instala é o dist, e nenhum teste de
 * fonte cobre a etapa que o produz.
 */

import { describe, expect, it } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const DIST = join(__dirname, '..', 'dist')

function readBundle(file: string): string {
  const path = join(DIST, file)
  // Falha explícita em vez de asserto vazio: sem build, este arquivo não testa nada e precisa dizer.
  expect(existsSync(path), `${file} não existe — rode \`bun run build\` antes`).toBe(true)
  return readFileSync(path, 'utf8')
}

describe('artefato publicado do notification-ui', () => {
  for (const file of ['index.js', 'headless.js']) {
    it(`${file} usa o runtime automático de JSX, não o clássico`, () => {
      const bundle = readBundle(file)

      // `React.createElement` só é válido se o `React` estiver importado — e o build não o importa.
      expect(bundle).not.toContain('React.createElement')
    })
  }

  it('index.js importa o jsx-runtime, que é a prova positiva do formato certo', () => {
    // A ausência de `React.createElement` sozinha passaria num bundle vazio; isto exige o oposto.
    expect(readBundle('index.js')).toContain('react/jsx-runtime')
  })

  it('não referencia o identificador React sem importá-lo', () => {
    const bundle = readBundle('index.js')
    const usesReactIdentifier = /(?<![.\w])React\./.test(bundle)
    const importsReactDefault = /import\s+React[,\s]|import\s+\*\s+as\s+React\s/.test(bundle)

    expect(
      !usesReactIdentifier || importsReactDefault,
      'o bundle usa `React.` sem importar o React — é o ReferenceError que quebrou o rc.1',
    ).toBe(true)
  })

  it('react e react-query ficam externos — duas cópias de React quebram os hooks', () => {
    const bundle = readBundle('index.js')

    expect(bundle).toContain('from "react"')
    expect(bundle).toContain('@tanstack/react-query')
    // Sinal de React embutido no bundle em vez de importado.
    expect(bundle).not.toContain('ReactCurrentOwner')
  })
})
