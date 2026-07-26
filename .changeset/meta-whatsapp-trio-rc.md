---
'@adatechnology/meta-whatsapp-contracts': minor
'@adatechnology/meta-whatsapp-module': minor
'@adatechnology/meta-whatsapp-provider': minor
'@adatechnology/meta-catalog-provider': minor
'@adatechnology/meta-graph-core': minor
'@adatechnology/conversations-ui': minor
---

Trio plugável `meta-whatsapp` — primeira release candidate.

Extração da capacidade WhatsApp em módulo plugável, conforme
`.specs/features/meta-whatsapp-trio/`.

**`meta-graph-core`** — fundação comum a qualquer API da Meta: `graphFetch`,
`buildGraphUrl`, `assertConfigField`, schemas de resposta e a hierarquia
`MetaGraphError`. Extraído do antigo `whatsapp-provider` para que catálogo e
mensagens não dupliquem o encanamento da Graph API.

**`meta-whatsapp-provider`** — SDK stateless de mensagens e templates
(renomeado de `whatsapp-provider`, agora consumindo `meta-graph-core`).
O catálogo saiu daqui: ver `meta-catalog-provider`.

**`meta-catalog-provider`** — SDK de catálogo (Meta Commerce), independente
de WhatsApp.

**`meta-whatsapp-contracts`** — fonte única de tipos do trio: schemas zod do
webhook, tipos de sessão/mensagem/fluxo/settings, hooks de extensão e as
portas (`ChannelAdapterInterface`, `CatalogPort` opcional,
`ObjectStorageInterface`, `RealtimeNotifierInterface`, `FlowActionRegistry`).

**`meta-whatsapp-module`** — a metade com estado: pgSchema `meta_whatsapp`
com migrations e journal próprios, repositórios de sessão/mensagem/fluxo/
settings, use-cases de conversa (takeover, release, log, export, listagem),
motor de fluxo com actions registráveis pelo host, e a camada de canal
(webhook assinado com anti-replay, envio com janela de 24h, ingestão de
mídia). `createMetaWhatsAppModule()` costura tudo; nada de `process.env`
dentro do pacote.

**`conversations-ui`** — componentes de conversa com paridade visual ao
produto de origem, telas de settings, e o editor de fluxograma no subpath
`./flows` (React Flow fica fora do bundle de quem importa só a raiz). Agora
tipa contra `meta-whatsapp-contracts` em vez de manter cópia própria dos
tipos.

**Migração de imports:** quem usava `@adatechnology/whatsapp-provider` deve
passar a importar de `@adatechnology/meta-whatsapp-provider`
(`WhatsAppMessageProvider`, `WhatsAppTemplateProvider`) e, no caso de
catálogo, de `@adatechnology/meta-catalog-provider` (`MetaCatalogProvider`,
antes `WhatsAppCatalogProvider`). As classes de erro passaram a vir de
`@adatechnology/meta-graph-core`.
