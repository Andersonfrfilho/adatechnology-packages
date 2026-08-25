---
'@adatechnology/notification-module': minor
---

A `delivery` passa a registrar o que foi anexado.

Coluna `attachments` (jsonb, nulável) com **nome e tipo. Sem url e sem conteúdo.**

A URL é assinada, e assinatura gravada é credencial gravada: ela ficaria no banco depois de vencer,
sem servir para nada além de vazar num dump. O nome fica porque é o que responde a pergunta que a
auditoria faz — *"que arquivo esse cliente recebeu?"* — e ele já saiu no e-mail do próprio
destinatário.

Gravado em **todo desfecho**, não só no sucesso: aquela pergunta tem uma irmã — *"o que a gente
tentou mandar?"* — e a segunda só se responde na entrega que falhou.

Migration `0001` é aditiva, uma coluna nulável, sem reescrita de tabela. Entrega sem anexo fica
`null`: array vazio e ausência dizem a mesma coisa, e `null` não ocupa linha de índice.

O `updateAttempt` espalha o campo em vez de atribuir direto — `undefined` num `set` do Drizzle
apagaria a coluna, e toda tentativa seguinte (retry, recibo de entrega) zeraria o registro.
