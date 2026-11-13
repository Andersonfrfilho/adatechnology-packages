import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema/schema.ts',
  out: './src/migrations',
  migrations: {
    table: 'notification_migrations',
  },
})
