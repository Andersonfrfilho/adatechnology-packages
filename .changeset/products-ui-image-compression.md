---
'@adatechnology/products-ui': minor
---

`ImageUpload` reduz a imagem no navegador quando ela passa dos 5MB, em vez de recusar o arquivo.

O operador fotografa o produto com o celular e a foto sai com 8MB e 4000px de lado. Recusar era
tecnicamente correto e inútil: ele não tem editor de imagem à mão. O teto do servidor continua de
pé como segunda barreira — a redução só evita que ele seja atingido por foto crua.

Decisões:

- **Imagem que já cabe não é reprocessada.** Recomprimir o que já servia perderia qualidade sem
  ganhar byte nenhum.
- **Redução pelo maior lado até 1600px antes de mexer na qualidade.** A imagem é renderizada numa
  bolha de conversa, nunca em tela cheia; é daí que vem quase toda a economia, sem borrar nada.
  Só depois a qualidade desce em escada (0.86 → 0.5), e só então o lado cai para 1024px.
- **PNG vira WebP**, que preserva a transparência que o JPEG jogaria fora — e PNG é sem perda, então
  recomprimir PNG como PNG não resolveria. JPEG segue JPEG, para não somar uma geração de perda.
- **Nunca lança**: formato fora da lista, navegador sem canvas ou recompressão que não encolheu
  devolvem o arquivo original, e quem recusa é o servidor.

`compressImage` e `PRODUCT_IMAGE_MAX_BYTES` são exportados para quem precisar da mesma redução fora
do componente.
