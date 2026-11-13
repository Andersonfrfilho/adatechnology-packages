import { defineConfig } from 'tsup'

export default defineConfig({
  // Um entrypoint por capacidade opcional: quem importa só `.` não carrega uWS, BullMQ nem AMQP
  // no grafo de módulos (spec §4, tabela de entrypoints).
  entry: ['src/index.ts', 'src/queue/bullmq.ts', 'src/queue/amqp.ts', 'src/openapi.ts', 'src/testing/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  // runMigrations.ts usa __dirname para achar a pasta migrations/ ao lado do dist — sem shim, o
  // build ESM não teria __dirname disponível.
  shims: true,
  // Migrations SQL não são código, e o tsup não as bundla: são copiadas como estão para o dist,
  // que é o único diretório publicado. `rm -rf` antes do cp porque sem isso a pasta acumula
  // migration de build anterior, e uma renomeada conviveria com a nova no pacote publicado.
  // São DUAS pastas, uma por formato de migrator do drizzle (ver `runMigrations.ts`).
  onSuccess:
    'rm -rf dist/migrations dist/migrations-v1 && mkdir -p dist/migrations dist/migrations-v1 && cp -r src/migrations/* dist/migrations/ && cp -r src/migrations-v1/* dist/migrations-v1/',
})
