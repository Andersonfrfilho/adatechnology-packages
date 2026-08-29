---
'@adatechnology/keycloak-admin': minor
---

Expose `listUsers` on the Keycloak admin client

O cliente sabia achar uma pessoa por e-mail e não sabia ler o realm. Sem essa leitura, quem existe
no Keycloak e não existe na base do produto é invisível — e é exatamente essa diferença que uma tela
de reconciliação de usuários precisa mostrar.

`listUsers({ first, limit, search })` devolve `{ users, hasMore }`. O Keycloak não informa total, e
contar o realm inteiro só para desenhar um botão de próxima página é caro: a chamada pede um
registro a mais que o limite e descarta-o, e é daí que `hasMore` sai — sem uma segunda ida à rede.
Busca em branco não vira filtro na query.
