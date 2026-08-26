---
'@adatechnology/user-contracts': minor
'@adatechnology/user-module': minor
'@adatechnology/user-ui': minor
---

Foto de perfil e envio de redefinicao de senha por usuario, dentro do SDK.

O modulo guarda a **chave** no banco e nunca a URL: a URL e assinada e expira, e persisti-la daria
uma coluna cheia de links mortos. A URL vai resolvida na resposta, porque `<img>` nao manda header
de autenticacao — uma rota autenticada simplesmente nao carregaria a imagem.

O armazenamento entra pela porta `AvatarStoragePort`, que o host pluga. Sem ela, as rotas de foto
nao sao publicadas: um produto sem bucket nao tem foto quebrada, nao tem foto.

Assinar em lote, uma vez por chave distinta e em paralelo; e falha ao assinar devolve a lista sem a
URL, nunca erro. Um bucket fora do ar nao pode transformar "listar usuarios" em 500 — a tela cai nas
iniciais, que e o mesmo desenho de quem nunca subiu foto.

A validacao roda antes de qualquer rede: gravar primeiro e conferir depois deixaria lixo no bucket a
cada tentativa recusada. `image/svg+xml` fica fora da lista por ser documento com script, que
servido do nosso dominio viraria XSS. A foto anterior so e apagada depois de a nova estar apontada,
e falhar nesse apagamento nao desfaz a troca — a nova ja e a verdade, e um objeto orfao custa
centavos.

A rota administrativa de redefinicao de senha responde 404 para usuario inexistente, ao contrario da
rota publica, que responde igual para e-mail existente e inexistente para nao virar oraculo de
cadastro. Quem chama a administrativa ja esta autenticado e ja enxerga a lista inteira. Ela so e
publicada quando ha reset **e** e-mail configurados: com token gerado e nenhum meio de entrega, o
botao pareceria funcionar sem fazer nada.
