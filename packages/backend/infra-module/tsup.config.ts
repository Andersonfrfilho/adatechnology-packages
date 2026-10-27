import { defineConfig } from 'tsup'

export default defineConfig({
  entry: { index: 'src/index.ts', testing: 'src/testing/index.ts' },
  format: ['esm', 'cjs'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  external: ['bun:test'],
  // runMigrations.ts usa __dirname para achar a pasta migrations/ ao lado do dist.
  shims: true,
  // Migrations SQL não são código: são copiadas como estão para o dist, limpando antes para não acumular as renomeadas.
  onSuccess: 'rm -rf dist/migrations && mkdir -p dist/migrations && cp -r src/migrations/* dist/migrations/',
})
