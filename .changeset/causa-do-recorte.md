---
'@adatechnology/image-cutout': patch
---

A causa da falha do recorte vai para o console em vez de morrer no `catch`.

A mensagem na tela e para quem esta usando; a causa e para quem vai consertar. Este recorte falha por
motivos que so o erro original distingue — CSP sem `wasm-unsafe-eval`, modelo 404, runtime que
carregou sem publicar `ort` — e engolir a causa transformava qualquer um deles na mesma frase
generica.

Foi exatamente assim que uma falha de cabecalho passou despercebida: o recurso nunca funcionou em
nenhum ambiente publicado, e o unico sinal era "Nao foi possivel remover o fundo".
