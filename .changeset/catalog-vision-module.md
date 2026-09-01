---
'@adatechnology/catalog-module': minor
---

Busca de produto por imagem, desligada por padrao.

A cascata para no primeiro degrau que decide: codigo de barras casa exato (`barcode` e unico por
empresa, nao ha similaridade a ponderar), o vetor traz vizinhos acima de um piso de score, e o
desempate opcional escolhe entre eles. Codigo lido sem produto cadastrado **nao** encerra a busca:
o item pode existir sem o GTIN preenchido, e desistir ali perderia justamente o produto da foto.

A migration tem journal proprio (`catalog_vision_migrations`). A extensao `vector` nao e contrib do
Postgres, e uma migration que falha derruba a subida do host inteiro — quem so gerencia catalogo
nao pode deixar de subir por uma capacidade que nao usa.

A condicao da busca escopa a empresa **nas duas pontas do join**, vetor e produto: o indice HNSW
ordena o espaco inteiro e nao enxerga fronteira de tenant, entao filtrar so um lado deixaria o
vizinho mais proximo de outra empresa entrar pelo join. Esta no teste de isolamento.

"Nenhum destes" do desempate e definitivo e vira `unmatched` — devolver os candidatos que ele
acabou de recusar transformaria a recusa em sugestao. Id fora da lista degrada para escolha manual,
nunca vira um produto que ninguem ofereceu.
