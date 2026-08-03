import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts', 'src/http/fetch.ts', 'src/http/uws.ts', 'src/openapi.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
})
