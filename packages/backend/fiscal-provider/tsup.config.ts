import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs'],
  target: 'node18',
  // tsup's bundled rollup-plugin-dts silently drops CupomPdfBuilder's exports from
  // the rolled-up dist/index.d.ts with this barrel — declarations are emitted by
  // `tsc` instead (see the `build` script in package.json).
  dts: false,
  clean: true,
  outDir: 'dist',
})
