import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts', 'src/schema/index.ts', 'src/testing/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  shims: true,
  async onSuccess() {
    const { cp, mkdir, readdir } = await import('node:fs/promises')

    // Falha alto de proposito: um pacote publicado sem `dist/migrations` instala limpo, sobe
    // limpo e so quebra quando o host descobre que o schema `payment` nunca foi criado. Engolir o
    // erro aqui trocaria um build vermelho por um incidente em producao.
    const entries = await readdir('src/migrations', { recursive: true }).catch(() => {
      throw new Error('payment-module: src/migrations ausente — rode `bun run db:generate` antes de buildar')
    })
    if (!entries.some((entry) => entry.endsWith('.sql'))) {
      throw new Error('payment-module: src/migrations sem nenhum .sql — rode `bun run db:generate`')
    }

    await mkdir('dist/migrations', { recursive: true })
    await cp('src/migrations', 'dist/migrations', { recursive: true })
  },
})
