import { defineConfig } from 'tsup'
export default defineConfig({
  // testing/ é entrada própria (export ./testing) para que os builders de preview não entrem no
  // bundle de quem só importa o módulo em produção.
  entry: ['src/index.ts', 'src/testing/index.ts'],
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
  // rm antes do cp: sem isso a pasta acumula migrations de builds anteriores, e uma renomeada
  // (ou um layout de journal trocado) fica convivendo com a versão nova no pacote publicado.
  // São DUAS pastas, uma por formato de migrator do drizzle (ver `runMigrations.ts`).
  onSuccess:
    'rm -rf dist/migrations dist/migrations-journal && mkdir -p dist/migrations dist/migrations-journal && cp -r src/migrations/* dist/migrations/ && cp -r src/migrations-journal/* dist/migrations-journal/',
})
