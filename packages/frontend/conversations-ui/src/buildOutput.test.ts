/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * O único teste que lê o `dist` em vez do fonte.
 *
 * Existe porque o `notification-ui@rc.1` saiu com 19 testes verdes e não renderizava. Dois defeitos,
 * os dois invisíveis para quem importa o fonte:
 *
 * 1. `jsx: react-jsx` chegava ao tsup por um tsconfig com `extends`, e o esbuild NÃO segue `extends`
 *    para essa opção. O bundle saiu com `React.createElement` sem `React` no escopo, e o produto
 *    quebrou com `ReferenceError: React is not defined`.
 * 2. `splitting: false` com dois entrypoints duplicou o módulo de contexto. O provider de um bundle
 *    não era o mesmo objeto do consumidor no outro, e o hook acusava "usado fora do provider" estando
 *    dentro de um.
 *
 * Nenhum teste de fonte pega isso: eles importam `./index`, não `dist`. Rode depois do build.
 */

import { describe, expect, it } from 'bun:test'

const DIST = `${import.meta.dir}/../dist`

async function distText(file: string): Promise<string> {
  const handle = Bun.file(`${DIST}/${file}`)
  expect(await handle.exists(), `${file} não existe — rode \`bun run build\` antes`).toBe(true)
  return handle.text()
}

describe('transform de JSX', () => {
  it('usa o runtime automático, e não React.createElement', async () => {
    for (const file of ['index.js', 'flows/index.js', 'preview/index.js']) {
      const content = await distText(file)

      expect(content, `${file} com createElement`).not.toContain('React.createElement')
      expect(content, `${file} sem jsx-runtime`).toContain('react/jsx-runtime')
    }
  })
})

describe('divisão de código entre entrypoints', () => {
  it('os entrypoints compartilham chunk em vez de duplicar módulo', async () => {
    // Sem `splitting: true`, cada entrypoint carrega a própria cópia dos módulos comuns — e um
    // contexto do React duplicado deixa de ser o mesmo objeto entre provider e consumidor.
    const chunks = [...new Bun.Glob('chunk-*.js').scanSync({ cwd: DIST })]

    expect(chunks.length, 'nenhum chunk compartilhado gerado').toBeGreaterThan(0)
  })
})

describe('telas compostas chegam ao pacote publicado', () => {
  it('o subpath raiz entrega MessagesWorkspace, no js e nos tipos', async () => {
    expect(await distText('index.js')).toContain('MessagesWorkspace')
    expect(await distText('index.d.ts')).toContain('MessagesWorkspace')
  })

  it('o subpath /flows entrega FlowsWorkspace, no js e nos tipos', async () => {
    // Export declarado no `index.ts` e ausente do `dist` é o modo de falhar mais barato de cometer e
    // mais caro de descobrir: só aparece no produto, depois de publicar.
    expect(await distText('flows/index.js')).toContain('FlowsWorkspace')
    expect(await distText('flows/index.d.ts')).toContain('FlowsWorkspace')
  })

  it('o CSS publicado traz as classes das duas telas', async () => {
    const css = await distText('styles.css')

    // A tela consome `cv-flows-canvas` para ter altura: sem a classe no CSS publicado o React Flow
    // colapsa para zero e a tela fica em branco, sem erro no console.
    expect(css).toContain('.cv-flows-canvas')
    expect(css).toContain('.cv-messages')
  })
})

describe('o bundle do host não paga por @xyflow/react sem pedir', () => {
  it('o subpath raiz não puxa o xyflow', async () => {
    // É o motivo de o editor viver em `/flows`: quem só usa a inbox não carrega a biblioteca de
    // canvas, que é a maior dependência do pacote.
    expect(await distText('index.js')).not.toContain('@xyflow/react')
  })
})
