---
'@adatechnology/notification-ui': patch
---

O quadro do preview deixa de pintar cartão branco atrás do aparelho.

`.adn-settings__preview-frame` pintava `--adn-color-surface` e desenhava borda — atrás de um
aparelho que já tem corpo, moldura e sombra próprios. Eram duas molduras concorrendo, e a de fora
sem significado: o que aparecia era um retângulo branco em volta do celular.

O quadro existe para prender a largura (`--adn-preview-width`) e aplicar o `zoom`. Isso ele continua
fazendo; o que sai é a pintura. O aparelho passa a flutuar sobre o canvas do preview.
