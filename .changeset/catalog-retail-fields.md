---
'@adatechnology/catalog-contracts': minor
'@adatechnology/catalog-module': minor
---

Campos de varejo no produto: marca, tamanho da embalagem, corredor e apelidos.

Todos opcionais, e `aliases` nasce com default `{}` — nenhum consumidor existente precisa preencher
nada nem fazer backfill.

A busca por texto passa a cobrir nome, marca e apelido. O apelido e o que faz "guarana" achar o
refrigerante cadastrado pelo nome da marca: o cliente digita como fala, nao como esta no cadastro. O
`or` dos tres campos fica dentro do `and` do tenant, e ha teste garantindo que ganhar campos nao
perdeu o escopo de empresa.

`aisle` e para quem separa o pedido: texto livre porque cada loja nomeia o proprio espaco, e o valor
util e o que esta escrito na placa pendurada no corredor — nao um codigo de enderecamento que
ninguem decora.

Migration `0001`, aditiva, com indice GIN em marca e apelidos: sem eles, procurar "guarana" varre a
tabela inteira, que e exatamente o caso de uso que os campos criam.
