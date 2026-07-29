---
'@adatechnology/meta-whatsapp-contracts': minor
'@adatechnology/meta-whatsapp-module': minor
'@adatechnology/conversations-ui': minor
---

Nó `send_media`: o fluxo envia arquivos da biblioteca no ponto que quem edita escolher.

Até agora, mandar material de apoio (tabela de preços, folder, contrato) no meio de uma conversa
era código de cada produto. Vira capacidade do canal: um nó `action` com `actionKind: 'send_media'`
pode ser posto em qualquer posição de qualquer grafo, e ao passar por ele o bot envia os arquivos
anexados àquele nó — imagem, PDF, vídeo, o que o mimeType disser.

Os arquivos **não** ficam em `actionParams`. Se ficassem, trocar o material exigiria editar e
republicar o grafo; o ponto é o inverso — quem cuida do conteúdo troca o arquivo na biblioteca e o
fluxo continua igual.

- `meta-whatsapp-contracts`: `FLOW_ACTION_KIND` passa a ser a fonte única do vocabulário built-in
  (o editor reexporta como `BUILT_IN_ACTION_KINDS` em vez de redeclarar os literais — duas listas
  divergiam em silêncio, produzindo nó publicável que nenhum handler atende);
  `ObjectStorageInterface.getObject` (opcional, como `delete`); hook `onFlowMediaError`.
- `meta-whatsapp-module`: tabela `meta_whatsapp.flow_media` (migration `0007_flow_media`),
  `FlowMediaRepository`, e `createSendMediaAction` — a única action built-in que o pacote
  implementa de ponta a ponta, registrada automaticamente quando há `objectStorage.getObject`.
- `conversations-ui`: `FlowNodePanel` ganha o slot `renderMediaPicker`. Slot, e não lista de
  arquivos por prop, porque upload, permissão e URL assinada são do host — o painel só reserva o
  lugar. O campo de mensagem direta some nesse nó: o handler só envia os anexos, então ali seria
  texto que o cliente nunca recebe (a legenda é por arquivo).

Tabela separada de `documents` por um motivo concreto, não por simetria: `documents` tem índice
único em `(companyId, uploadId)` porque lá binário repetido é reentrega de job. Um arquivo da
biblioteca vai, por definição, para todo cliente que passar pelo nó — aquele índice barraria o
segundo envio. Por isso a action registra no transcript (com `uploadId` no payload, que é o que o
painel precisa para renderizar e baixar) mas não linka em `documents`.

Falha de um arquivo não derruba a conversa: o erro vai para `onFlowMediaError` e o envio segue
para o próximo anexo e para o próximo nó — um PDF que não subiu deixaria o cliente parado num nó
que não pede resposta.
