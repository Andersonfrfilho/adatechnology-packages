import { defineConfig } from 'tsup'
export default defineConfig({
  // testing/ é entrada própria (export ./testing): builders de preview não entram no bundle de
  // quem só consome os contratos em produção.
  entry: ['src/index.ts', 'src/testing/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
})
