import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts', 'src/headless.ts', 'src/styles.css'],
  format: ['esm'],
  dts: { entry: ['src/index.ts', 'src/headless.ts'] },
  /**
   * `splitting: true` é OBRIGATÓRIO aqui, e não preferência de tamanho de bundle.
   *
   * Com dois entrypoints e splitting desligado, o tsup INLINE o código compartilhado em cada um —
   * e `NotificationContext` virava duas instâncias distintas. Um `<NotificationProvider>` importado
   * de `.` nunca alimentava um `useUnreadCount` importado de `./headless`: o hook lançava
   * "componente usado fora de <NotificationProvider>" mesmo estando dentro dele.
   *
   * É a divisão de camadas do pacote (componentes em `.`, hooks em `/headless`) que torna o
   * compartilhamento obrigatório — as duas entradas precisam ler o MESMO objeto de contexto.
   */
  splitting: true,
  sourcemap: true,
  clean: true,
  external: ['react', 'react-dom', '@tanstack/react-query'],
  /**
   * `jsx` NÃO é configurado aqui de propósito — vem do `tsconfig.json` do pacote, que precisa
   * declarar `jsx: react-jsx` DIRETAMENTE, sem `extends`.
   *
   * O esbuild lê a opção do tsconfig do pacote mas não segue `extends` para resolvê-la. Herdando,
   * `tsc` e `bun test` concordavam com `react-jsx` enquanto o build emitia `React.createElement` sem
   * importar o `React` — e o rc.1 foi publicado lançando `ReferenceError` no primeiro render.
   * `src/buildOutput.test.ts` trava isso olhando o dist.
   */
})
