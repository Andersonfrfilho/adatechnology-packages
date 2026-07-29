---
"@adatechnology/conversations-ui": patch
---

`InteractiveMessage` formata cabeçalho, corpo e rodapé com a marcação do WhatsApp.

O texto do menu era renderizado cru, então `*negrito*` aparecia com os asteriscos à mostra — e como
mensagem de texto comum já formatava, a mesma conversa exibia os dois comportamentos alternando.

Título e descrição de opção seguem literais de propósito: é o que o aparelho faz, e formatá-los aqui
deixaria o simulador mais bonito que o WhatsApp.
