/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */
import { defineConfig } from 'tsup'

export default defineConfig({
  // Duas entradas: o engine local é subpath próprio para não entrar no bundle de quem usa só o
  // hospedado — ver o cabeçalho de whisper-local.service.ts.
  entry: ['src/index.ts', 'src/whisper-local/index.ts'],
  format: ['esm'],
  target: 'esnext',
  dts: true,
  clean: true,
  outDir: 'dist',
})
