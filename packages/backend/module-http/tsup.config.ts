import { defineConfig } from 'tsup'

export default defineConfig({
  // Um entrypoint por transporte: quem monta em Bun.serve não carrega o adaptador uWS no grafo.
  entry: ['src/index.ts', 'src/fetch.ts', 'src/uws.ts', 'src/openapi.ts', 'src/testing/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
})
