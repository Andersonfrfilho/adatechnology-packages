import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts', 'src/guest/index.ts', 'src/styles.css'],
  format: ['esm'],
  dts: { entry: ['src/index.ts', 'src/guest/index.ts'] },
  sourcemap: true,
  clean: true,
  external: ['react', 'react-dom'],
  // `jsx` vem do tsconfig do pacote, declarado direto (sem `extends`): o esbuild não segue
  // `extends` para essa opção — ver `notification-ui/tsup.config.ts`.
})
