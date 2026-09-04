---
'@adatechnology/customer-contracts': patch
---

Erro de domínio ganha `statusCode`, e para de virar 500

O filtro do `module-http` reconhece erro de domínio pela FORMA — `statusCode`, `code`, `message` —,
e nenhum erro do pacote tinha `statusCode`. Todos viravam "Erro interno": a ficha inexistente
respondia 500 em vez de 404, o número de WhatsApp já usado respondia 500 em vez de 409, e o campo
fora do catálogo respondia 500 em vez de 400.

O status é derivado do código numa tabela só, e não passado em cada construtor: assim não há como
divergir, e código novo sem entrada na tabela não compila.
