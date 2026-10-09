/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */
import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts', 'src/barcode/index.ts', 'src/clip-local/index.ts', 'src/vlm-ollama/index.ts'],
  format: ['esm'],
  target: 'esnext',
  dts: true,
  clean: true,
  outDir: 'dist',
})
