---
'@adatechnology/image-cutout': minor
---

O fundo do recorte aceita a cor de quem hospeda, além de branco e transparente

`fill` passa a aceitar `{ color: '#0b3d2e' }`. As duas palavras continuam valendo e o padrão
continua sendo branco — nada muda para quem já usa.

A cor existe porque "branco ou transparente" não cobre **foto de perfil**: um avatar recortado sobre
branco numa tela escura vira um selo branco colado na página, e sobre transparente ele se dissolve
no que estiver atrás. Catálogo tem um fundo certo; avatar tem o fundo do produto que o mostra.

⚠️ **Só hexadecimal.** O valor vai para `fillStyle`, que aceita qualquer string e **ignora em
silêncio** a que não entende — uma cor inválida sairia como fundo transparente, sem erro, e a falha
apareceria semanas depois como "às vezes o recorte fica sem fundo". Nome de cor CSS e `var(--token)`
são recusados na chamada pelo mesmo motivo: o token não existe dentro do canvas.
