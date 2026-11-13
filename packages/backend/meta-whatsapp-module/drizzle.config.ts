import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema/schema.ts',
  out: './src/migrations',
  // Journal próprio (T1.1/T3.1) — nunca colide com as migrations do host, que roda as suas
  // por um caminho totalmente separado. Fica no schema padrão (public), não dentro de
  // meta_whatsapp: a primeira migration é quem cria esse schema (ver runMigrations.ts).
  migrations: {
    table: 'meta_whatsapp_migrations',
  },
})
