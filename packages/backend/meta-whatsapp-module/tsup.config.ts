import { defineConfig } from 'tsup'
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  // runMigrations.ts usa __dirname para achar a pasta migrations/ ao lado do dist — sem shim,
  // o build ESM não teria __dirname disponível.
  shims: true,
  // Migrations SQL não são código — tsup não as bundla; copiadas como estão para o dist depois
  // do build, e runMetaWhatsAppMigrations() acha a pasta via __dirname relativo ao pacote publicado.
  onSuccess: 'mkdir -p dist/migrations && cp -r src/migrations/* dist/migrations/',
})
