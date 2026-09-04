---
'@adatechnology/customer-contracts': minor
---

Nasce o `customer-contracts`: tipos, schemas e portas do cadastro de cliente

Contratos do trio `customer`, sem comportamento em execução. Cliente é identidade de COMPRA, com o
número de WhatsApp como chave — deliberadamente distinto do `user`, que é identidade de LOGIN.

Telefone, endereço e documento são coleções, porque uma pessoa tem vários de cada, e qual número é
o do WhatsApp é atributo do telefone.

Campo customizado vive em `attributes`, validado contra um catálogo declarado pela instalação —
jsonb com forma, não jsonb solto.
