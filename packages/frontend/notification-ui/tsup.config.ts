import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts', 'src/headless.ts', 'src/styles.css'],
  format: ['esm'],
  // `dts` recebe só os entrypoints TS: incluir o CSS aqui faz o gerador de declarações abortar
  // com TS6054 (extensão não suportada).
  dts: { entry: ['src/index.ts', 'src/headless.ts'] },
  splitting: false,
  sourcemap: true,
  clean: true,
  external: ['react', 'react-dom', '@tanstack/react-query'],
})
