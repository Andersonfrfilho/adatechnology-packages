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
  onSuccess: 'rm -rf dist/migrations && mkdir -p dist/migrations && cp -r src/migrations/* dist/migrations/',
})
