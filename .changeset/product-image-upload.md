---
"@adatechnology/catalog-contracts": minor
"@adatechnology/catalog-module": minor
"@adatechnology/products-ui": minor
---

Upload de imagem de produto ponta a ponta

A `ProductImageStoragePort` existia e não era consumida por ninguém: o componente de
upload ficava órfão no pacote de UI e o formulário só aceitava URL digitada.

`catalog-module` ganha `UploadProductImageUseCase` e a rota `POST /products/images`,
publicada apenas quando o host injeta a porta — sem bucket, a rota não existe. O corpo
são os bytes crus, com o formato vindo do `Content-Type`: base64 em JSON inflaria 33%
do tráfego e multipart pediria um parser só para isto. Formato entra por lista fechada
(jpeg, png, webp — SVG carrega script), teto de 5MB, e a chave é
`products/<empresa>/<uuid>.<ext>`, sem nada digitado pelo usuário, porque ela vira URL
pública.

Em `products-ui`, `uploadImage` passa a ser opcional em `ProductsApi`: com a capacidade,
o formulário mostra o alvo de arrastar arquivo e mantém o campo de URL ao lado; sem ela,
segue só a URL. O componente troca o SVG solto por ícones da biblioteca e a área de
soltar vira botão de verdade, alcançável pelo teclado.
