import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts', 'src/schema/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  shims: true,
  async onSuccess() {
    const { cp, mkdir, readdir } = await import('node:fs/promises')

    // Falha alto de propósito: pacote publicado sem `dist/migrations` instala limpo, sobe limpo e
    // só quebra quando o host descobre que o schema `recommendation` nunca foi criado.
    const entries = await readdir('src/migrations', { recursive: true }).catch(() => {
      throw new Error('recommendation-module: src/migrations ausente')
    })
    if (!entries.some((entry) => entry.endsWith('.sql'))) {
      throw new Error('recommendation-module: src/migrations sem nenhum .sql')
    }

    await mkdir('dist/migrations', { recursive: true })
    await cp('src/migrations', 'dist/migrations', { recursive: true })
  },
})
