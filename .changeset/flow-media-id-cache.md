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

O store é porta, então cada host escolhe onde guardar (coluna, Redis, memória). Nada muda para quem
não passar o cache.
