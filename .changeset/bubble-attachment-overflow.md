---
'@adatechnology/conversations-ui': patch
---

Foto no balão não sai mais pela borda: o anexo do balão (`<figure>`) zera a margem do navegador, ganha `min-width: 0` e `max-width: 100%`, e a imagem escala com `height: auto`.
