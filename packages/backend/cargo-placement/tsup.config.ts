/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */
import { defineConfig } from 'tsup'

export default defineConfig({
  entry: { index: 'src/index.ts', 'fixtures/index': 'src/fixtures/index.ts' },
  format: ['esm'],
  target: 'esnext',
  dts: true,
  clean: true,
  splitting: false,
  outDir: 'dist',
})
