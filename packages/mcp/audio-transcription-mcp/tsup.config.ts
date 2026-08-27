/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */
import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/main.ts', 'src/server.ts'],
  format: ['esm'],
  target: 'esnext',
  dts: true,
  clean: true,
  outDir: 'dist',
  banner: { js: '#!/usr/bin/env node' },
})
