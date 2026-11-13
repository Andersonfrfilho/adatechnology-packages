/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */
import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'esnext',
  dts: true,
  clean: true,
  external: ['bun', 'drizzle-orm', 'drizzle-orm/*'],
  outDir: 'dist',
})
