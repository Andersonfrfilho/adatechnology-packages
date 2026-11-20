import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts', 'src/schema/index.ts', 'src/http/fetch.ts', 'src/openapi.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  shims: true,
  async onSuccess() {
    const { cp, mkdir, readdir } = await import('node:fs/promises')

    // Falha alto de propósito: pacote publicado sem `dist/migrations` instala e sobe limpo, e só quebra quando o host
    // descobre que o schema `expense` nunca foi criado.
    const entries = await readdir('src/migrations', { recursive: true }).catch(() => {
      throw new Error('expense-module: src/migrations ausente — rode `pnpm run db:generate` antes de buildar')
    })
    if (!entries.some((entry) => entry.endsWith('.sql'))) {
      throw new Error('expense-module: src/migrations sem nenhum .sql — rode `pnpm run db:generate`')
    }

    await mkdir('dist/migrations', { recursive: true })
    await cp('src/migrations', 'dist/migrations', { recursive: true })
  },
})
