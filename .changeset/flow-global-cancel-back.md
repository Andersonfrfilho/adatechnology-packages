---
'@adatechnology/meta-whatsapp-module': minor
---

Palavras globais `cancel` e `back` no runner de fluxo (opt-in): `cancel` apaga o que foi coletado, envia `cancelMessage` e encerra o fluxo; `back` refaz a pergunta anterior com o contexto que ela tinha (sem anterior, equivale a `restart`). `restart` e `flow:<chave>` passam a zerar o rastro de `back`.
