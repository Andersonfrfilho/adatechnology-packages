---
'@adatechnology/meta-whatsapp-contracts': minor
'@adatechnology/meta-whatsapp-provider': minor
'@adatechnology/meta-whatsapp-module': minor
---

Arquivo de fluxo deixa de ressubir para cada cliente: `send_media` ganha cache de `mediaId`.

O nó `send_media` fazia, **por cliente e por arquivo**, duas operações caras: baixava o binário do
storage e o subia inteiro para a Meta (`POST {phoneNumberId}/media`) só para obter um `media_id` e
então enviar. É o mesmo arquivo, idêntico, subindo de novo para todo mundo que passa pelo nó — e a
rota é aguardada no caminho do roteador, então o cliente espera. Com dois anexos, as latências somam,
porque o envio é sequencial de propósito (a ordem é o que o cliente lê).

A Meta aceita reusar um `media_id` por 30 dias. Agora dá para guardá-lo:

- **`ChannelAdapterInterface.sendMedia` aceita `mediaId` no lugar do `buffer`, e devolve o `mediaId`
  usado.** Os dois campos são uma união, não dois opcionais: com ambos opcionais, "esqueci de passar
  os dois" compila e só quebra na chamada à Meta, em produção.
- **`createSendMediaAction` aceita `mediaIdCache`** — capacidade por ausência: sem ele, o
  comportamento é exatamente o anterior, e não há flag para desligar. Com ele, o caminho rápido não
  faz nenhuma das duas operações caras: nem baixa do storage, nem sobe o binário.
- **O `senderKey` vem dentro do objeto do cache, não solto.** O `media_id` é escopado ao
  `phone_number_id`; cachear sem separar por número manda o id de um número pelo outro. Exigi-lo
  junto do store torna "liguei o cache e esqueci o número" impossível de escrever.
- **Id vencido não perde a entrega.** Falha no caminho rápido limpa o cache e sobe o binário na mesma
  passada. Trata falha de rede igual a id expirado de propósito — distinguir as duas exigiria
  inspecionar código de erro da Graph API, custa uma tentativa a mais no pior caso e acerta nos dois.
  Sem isso, um id vencido pararia de entregar material em silêncio.
- **Só grava depois do envio confirmado**, e só se a resposta trouxe o id.

**E vem ligado por padrão, sem host nenhum precisar escrever código.** A tabela `flow_media` é do
módulo, a coluna nova (`meta_media_ids`, migration `0010`) é do módulo, e o módulo já registra a
action `send_media` sozinho — então ele passa o próprio `FlowMediaIdRepository` e o `phoneNumberId`
que já tem em mãos. Exigir que cada host escrevesse o repositório faria todos reescreverem o mesmo
código e, até escreverem, o binário continuaria subindo por cliente.

O store continua sendo porta: quem quiser guardar noutro lugar (Redis) troca o `store`. Quem não
fizer nada já sai sem ressubir.

A coluna é um mapa `phone_number_id → media_id`, gravado com `jsonb_set` no banco em vez de
ler-alterar-escrever na aplicação: dois clientes passando pelo nó ao mesmo tempo por números
diferentes leriam o mesmo mapa e o último gravaria por cima, apagando o id do outro. A validade não
é guardada de propósito — confiar em "30 dias" calculados erra nos casos de borda, e quem decide é a
recusa da Meta, que devolve ao caminho de subir o binário.

A migration é aditiva com default: linha existente nasce com mapa vazio e cai no caminho antigo.
