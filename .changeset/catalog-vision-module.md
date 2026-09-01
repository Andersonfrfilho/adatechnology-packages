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

Duas guardas contra troca de modelo em silencio: dimensao divergente derruba a composicao no boot
(a coluna do indice tem tamanho fixo, e um provider de outro tamanho so poderia gravar vetor
truncado, que continua respondendo — com o produto errado), e `verifyVisionIndex` confere o modelo
que construiu o indice contra o do provider. A segunda le o banco, entao e assincrona e o host a
chama depois das migrations; indice vazio nao e divergencia.

A busca sobe o `hnsw.ef_search` para 200 dentro de uma transacao (`SET LOCAL`, para nao vazar na
conexao do pool). O default do pgvector e 40, e o indice nao conhece o filtro de empresa: ele acha
os N vizinhos do INDICE INTEIRO e o Postgres descarta depois os de outra empresa, entao a busca
devolve menos candidatos do que pediu — sem erro nenhum, e a conversa mostra menos opcoes ou
nenhuma.

Medido num Postgres real com pgvector, 12 mil vetores em 3 empresas: pedindo 20 vizinhos, uma das
empresas recebia 11. Com 100 o recall volta a ser completo; 200 e o dobro, de margem para bases com
mais empresas.
