---
'@adatechnology/keycloak-admin': minor
---

Add profile picture support to the Keycloak admin client

`setProfilePicture({ userId, pictureUrl })` grava a URL no atributo `picture` — o nome que o OIDC
reserva para isso. Com um mapeador no realm ele chega ao token, e a tela desenha o avatar sem uma
consulta por pessoa.

A operação **lê os atributos antes de gravar**, porque o Admin API substitui o conjunto quando
recebe `attributes`: mandar só a foto apagaria `company_id`, `tax_id` e qualquer outro atributo do
produto — e o sintoma apareceria longe da causa, como login entrando sem empresa horas depois.
Preservar o resto está em teste.

⚠️ O valor é uma **URL**: o Keycloak não hospeda imagem, e base64 no atributo cresce o token até ele
parar de caber no cabeçalho. Onde o arquivo mora é decisão do produto.
