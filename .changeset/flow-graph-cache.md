---
'@adatechnology/meta-whatsapp-contracts': minor
'@adatechnology/meta-whatsapp-module': minor
---

Cache opcional dos grafos de fluxo, com invalidação na publicação.

O grafo é lido a cada mensagem que chega — é o caminho mais quente do bot, e sem cache cada "oi"
de cliente vira uma leitura completa no banco. Passa a ser cacheável, mas nunca por conta própria:
o host injeta o provedor e liga o recurso.

- `meta-whatsapp-contracts`: `CacheInterface` (`get`/`set`/`delete`, valores em texto — serializar
  é de quem usa, para o contrato não impor formato).
- `meta-whatsapp-module`: `providers.cache` e `features.flowGraphCache`
  (`boolean | { ttlSeconds }`, **desligado por omissão**); `FlowGraphCache`; `FlowGraphRepository`
  passa a ler pelo cache e a invalidar em `create`, `save` e `delete`.

Desligado por omissão porque cachear é decisão de quem opera: o cache precisa ser compartilhado
entre instâncias, e um cache por processo faria cada instância servir uma versão diferente do
mesmo fluxo depois de uma publicação — a invalidação de uma não alcançaria as outras. Sem
`providers.cache` o flag é ignorado; o módulo não abre conexão própria.

TTL **e** invalidação explícita, não um dos dois: só TTL deixaria o cliente andando no grafo
antigo até expirar, logo depois de alguém corrigir o fluxo no editor; só invalidação deixaria
cache envenenado para sempre se um `delete` se perdesse (Redis reiniciando, deploy no meio).

`save` invalida em vez de reescrever a entrada com o grafo novo: reescrever perde a corrida contra
uma leitura concorrente que buscou a versão anterior e ainda não gravou — o cache ficaria com o
grafo velho e o TTL cheio pela frente.

Toda operação de cache é tolerante a falha, incluindo JSON corrompido na chave: cache é
aceleração, não dependência. Redis fora do ar degrada para leitura no banco — o mesmo
comportamento de quem não configura cache nenhum — em vez de derrubar a conversa do cliente.

A chave inclui `companyId`: a chave do fluxo é escolhida por quem edita e se repete entre empresas
(`consorcio` existe em todas), então uma chave sem tenant serviria o grafo de uma empresa para a
conversa de outra.
