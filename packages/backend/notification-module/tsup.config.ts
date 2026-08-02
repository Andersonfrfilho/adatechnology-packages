import { defineConfig } from 'tsup'

export default defineConfig({
  // Um entrypoint por capacidade opcional: quem importa só `.` não carrega uWS, BullMQ nem AMQP
  // no grafo de módulos (spec §4, tabela de entrypoints).
  entry: [
    'src/index.ts',
    'src/http/fetch.ts',
    'src/http/uws.ts',
    'src/queue/bullmq.ts',
    'src/queue/amqp.ts',
    'src/openapi.ts',
    'src/testing/index.ts',
  ],
  format: ['esm', 'cjs'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
})
