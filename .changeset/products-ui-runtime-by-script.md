---
'@adatechnology/products-ui': patch
---

Carrega o runtime de recorte por `<script>`, e não por `import()`

O `onnxruntime-web` importa o próprio loader `.mjs` em tempo de execução, e todo bundler
reescreve esse import do seu jeito — o Vite chega a recusar o arquivo por estar em `public/`,
respondendo 500 no meio do primeiro recorte. Por fora do grafo de módulos isso não acontece.

`BackgroundRemovalConfig` passa a exigir `runtimeUrl` (o `ort.wasm.min.js` servido pelo host),
e o pacote deixa de ter `onnxruntime-web` como peer dependency: quem não usa recorte não
instala nada a mais.
