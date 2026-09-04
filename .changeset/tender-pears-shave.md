---
'@adatechnology/customer-module': patch
---

Número de WhatsApp que já tem dono devolve 409, e não "Erro interno"

Cadastrar uma ficha nova com um número que já pertence a outro cliente batia no índice único e
subia como erro cru — o operador via "Erro interno" e não tinha o que fazer com isso. Agora a
violação é traduzida em `WhatsAppPhoneTakenError`, que o filtro mapeia para 409 com mensagem.

O `UpsertByPhone` continua relendo em vez de recusar, e a diferença é proposital: lá duas mensagens
do mesmo número são a mesma pessoa; aqui, reler juntaria duas pessoas numa ficha só.

Apareceu no primeiro produto que adotou o pacote, exercitando a rota com uma sessão real.
