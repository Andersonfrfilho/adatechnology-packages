---
'@adatechnology/meta-whatsapp-module': minor
---

Arquivo enviado pelo atendente entra na biblioteca da conversa.

`SendMessageUseCase.sendMedia` já mandava o binário ao cliente pelo canal e já copiava para o
storage; o que faltava era o vínculo. Agora ele linka o documento com `source` igual ao
remetente (`agent` quando saiu da inbox), apontando para a mensagem criada — quem assume a
conversa depois acha o que já foi enviado sem rolar a thread inteira.

Duas guardas, ambas cobertas por teste:

- **não linka quando `logMessage` devolve `undefined`**, que é entrega duplicada — linkar aí
  criaria uma segunda linha no painel para o mesmo envio;
- **não linka sem storage injetado**, porque sem objeto não há destino e documento sem
  destino é linha morta no painel.

`sizeBytes` vem do buffer, não de campo informado pelo cliente da API.
