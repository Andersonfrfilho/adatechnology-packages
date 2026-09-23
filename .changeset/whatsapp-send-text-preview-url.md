---
'@adatechnology/meta-whatsapp-contracts': minor
'@adatechnology/meta-whatsapp-provider': minor
'@adatechnology/meta-whatsapp-module': minor
---

`sendText` aceita `options.previewUrl`, que pede à Meta o cartão de pré-visualização do primeiro
link do corpo.

Sem isso, uma mensagem com link sai como URL crua — e não havia como pedir o cartão, porque o campo
`preview_url` da Graph API não estava exposto em lugar nenhum da cadeia (contrato, adapter, provider).

Desligado por omissão, que é o padrão da própria Graph API: o cartão puxa título, descrição e imagem
do destino, e isso não pode virar comportamento automático de todo texto que por acaso contenha uma
URL. O campo só é enviado quando pedido.

Vale registrar o limite, porque ele é a origem da confusão que motivou isto: **o cartão só existe em
mensagem de texto**. `interactive` — botões e listas — nunca renderiza pré-visualização, com ou sem
o campo. Um resumo com link dentro de `sendInteractiveButtons` continuará mostrando a URL crua, e a
saída é mandar o link como mensagem de texto própria.

Aditivo: `options` é opcional e toda chamada existente segue idêntica.
