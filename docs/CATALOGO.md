# Catálogo de capacidades do SDK

Este arquivo lista o que cada pacote de `packages/backend`, `packages/frontend` e `packages/mcp` entrega a quem consome. **Leia antes de escrever código num app**: simulador de conversa, motor de fluxos, editor de modelos de e-mail e tela de equipe já existem aqui, e reescrevê-los à mão cria uma segunda cópia que diverge.

> **Regra de manutenção:** todo PR que cria um pacote ou uma capacidade nova atualiza a entrada correspondente neste arquivo, no mesmo PR (ver `CLAUDE.md`).
>
> Levantado em 2026-11-25 a partir dos `package.json`, dos `src/index.ts` e dos READMEs. Versões mudam a cada release: a fonte de verdade é o `package.json` de cada pacote. A coluna "Usado por" vem das dependências declaradas nos `package.json` dos repositórios irmãos em `~/Documents/personal` (até 4 níveis de profundidade, sem worktrees): uso só por import transitivo ou em pasta mais funda não aparece. "Não verificado" marca o que foi inferido do código sem README ou sem execução.

## Antes de escrever código num app, procure aqui

Organizado por necessidade. Se a necessidade está na lista, use o pacote: não reimplemente.

### Atendimento por WhatsApp (Meta oficial)

| Pacote | O que resolve | Entrada |
|---|---|---|
| [`meta-whatsapp-module`](#adatechnologymeta-whatsapp-module) | webhook assinado e idempotente, sessões, mensagens, takeover humano, SSE, mídia e transcrição | `createMetaWhatsAppModule` |
| [`meta-whatsapp-provider`](#adatechnologymeta-whatsapp-provider) | enviar texto, mídia, botões e templates pela Cloud API | `createWhatsAppProvider` |
| [`conversations-ui`](#adatechnologyconversations-ui) | inbox, conversa no desenho do WhatsApp, respostas rápidas, templates, documentos | `ConversationsWorkspace` |
| [`evolution-whatsapp-provider`](#adatechnologyevolution-whatsapp-provider) | alternativa gratuita e não oficial (risco de banimento) | `EvolutionWhatsAppChannel` |

### Robô / fluxo de conversa (não escreva um motor de fluxo à mão)

| Pacote | O que resolve | Entrada |
|---|---|---|
| [`meta-whatsapp-module`](#adatechnologymeta-whatsapp-module) | **motor de fluxos**: grafo com perguntas, menus, condições e ações; salto entre fluxos; handoff para humano; grafos salvos no banco | `FlowInterpreter` (`src/flows/FlowInterpreter.ts`), `FlowGraphRepository`, `SaveFlowGraphUseCase` |
| [`meta-whatsapp-contracts`](#adatechnologymeta-whatsapp-contracts) | formato do grafo (`FlowGraphData`, tipos de nó e de ação) compartilhado entre backend e editor | `flowGraphNodesSchema`, `FLOW_ACTION_KIND` |
| [`conversations-ui`](#adatechnologyconversations-ui) | **editor visual de fluxos** com prévia no desenho do WhatsApp e posições vivas das conversas | `FlowsWorkspace`, `FlowWhatsAppPreview` (subpath `./flows`) |

### Simular uma conversa sem a Meta (não escreva um simulador à mão)

| Pacote | O que resolve | Entrada |
|---|---|---|
| [`conversations-ui`](#adatechnologyconversations-ui) | **simulador de cliente**: painel com texto, botões, listas, áudio e mídia; sem segredo no navegador usando a ponte | `ConversationSimulatorPanel`, `createPreviewBridgeClient` (subpath `./preview`) |
| [`meta-whatsapp-contracts`](#adatechnologymeta-whatsapp-contracts) | builders de payload inbound que rodam no navegador e no servidor (a rota da ponte usa para montar o webhook) | `buildInboundTextPayload` e irmãos em `./testing` |
| [`meta-whatsapp-module`](#adatechnologymeta-whatsapp-module) | aceita mídia do simulador quando `features.previewMedia` está ligado (só ambiente de simulação) | `createMetaWhatsAppModule({ features: { previewMedia: true } })` |
| [`web-chat-widget`](#adatechnologyweb-chat-widget) | transporte do simulador para o chat web | `createWebChatSimulatorClient` (`./simulator`) |

### Painel de conversas da equipe

| Pacote | O que resolve | Entrada |
|---|---|---|
| [`conversations-ui`](#adatechnologyconversations-ui) | lista, conversa, composer com áudio, janela de 24 h, anexos, notificação de espera | `ConversationsWorkspace`, `ConversationPane` |
| [`conversation-module`](#adatechnologyconversation-module) | núcleo multicanal (WhatsApp, e-mail e outros) com anexos e não atribuídas | `createConversationModule` |
| [`meta-whatsapp-module`](#adatechnologymeta-whatsapp-module) + [`conversations-ui`](#adatechnologyconversations-ui) | **respostas rápidas por empresa** (atalho `/` do composer e tela de cadastro): tabela, casos de uso, rotas e a porta do painel prontos | `createMetaWhatsAppQuickReplyRoutes`, `createMetaWhatsAppQuickRepliesClient` |

### Chat no site do cliente

| Pacote | O que resolve | Entrada |
|---|---|---|
| [`web-chat-widget`](#adatechnologyweb-chat-widget) | widget como Web Component, sem React | `<ada-chat-widget>`, `registerAdaChatWidget` |

### Login e usuários da equipe

| Pacote | O que resolve | Entrada |
|---|---|---|
| [`user-module`](#adatechnologyuser-module) | login local ou Keycloak, refresh, reset de senha, perfil, lista de equipe | `createUserModule`, `createUserRoutes` |
| [`login-lockout`](#adatechnologylogin-lockout) | bloqueio progressivo de login por tentativas (15, 30, 60 min...), inclusive de identificador que não existe | `createLoginLockout` |
| [`user-ui`](#adatechnologyuser-ui) | telas de login, recuperação, perfil e equipe | `UserWorkspace`, `TeamWorkspace` |
| [`keycloak-jwt`](#adatechnologykeycloak-jwt) | validar access token no backend Bun | `createKeycloakJwtVerifier` |
| [`keycloak-admin`](#adatechnologykeycloak-admin) | gerenciar usuários do realm por service account | `createKeycloakAdminClient` |
| [`identity-reconciliation`](#adatechnologyidentity-reconciliation) | casar usuários do produto com o realm | `reconcileIdentities` |

### Cadastro de clientes

| Pacote | O que resolve | Entrada |
|---|---|---|
| [`customer-module`](#adatechnologycustomer-module) | clientes com campos customizados, endereços, documento e telefone | `createCustomerModule` |
| [`customers-ui`](#adatechnologycustomers-ui) | lista, ficha e configuração de campos | `CustomerList`, `CustomerDetail` |
| [`document-intake`](#adatechnologydocument-intake) | CPF/CNPJ (inclusive alfanumérico): detectar, validar, formatar, máscara progressiva, exibição mascarada; normalizar nome de pessoa | `isValidBrazilianDocument`, `maskBrazilianDocumentInput`, `normalizePersonName` |
| [`customers-ui`](#adatechnologycustomers-ui) | campo único de CPF ou CNPJ com máscara progressiva | `BrazilianDocumentInput` |

### Catálogo, cardápio e produtos

| Pacote | O que resolve | Entrada |
|---|---|---|
| [`catalog-module`](#adatechnologycatalog-module) | produtos, seções, estoque atômico, importação em lote, busca por foto, publicação opcional na Meta | `createCatalogModule`, `createCatalogRoutes` |
| [`products-ui`](#adatechnologyproducts-ui) | gestão de produtos e catálogos com envio de imagem e recorte de fundo; API pronta para o `catalog-module` | `ProductsWorkspace` (opt-in `listing`), `createCatalogModuleProductsApi` |
| [`product-vision-provider`](#adatechnologyproduct-vision-provider) | identificar produto por foto (código de barras e CLIP) | `createVisionChain` |
| [`catalog-image-storage-provider`](#adatechnologycatalog-image-storage-provider) | imagens de produto em bucket S3 | `createS3ProductImageStorage` |
| [`meta-catalog-provider`](#adatechnologymeta-catalog-provider) | catálogo da Meta Commerce | `MetaCatalogProvider` |
| [`recommendation-module`](#adatechnologyrecommendation-module) | itens patrocinados ou curados, campanhas e métricas | `createRecommendationModule` |

### Blog, novidades e conteúdo

| Pacote | O que resolve | Entrada |
|---|---|---|
| [`content-module`](#adatechnologycontent-module) | posts em Markdown com slug, capa, tags, SEO, rascunho, agendamento e arquivo; rotas de painel e públicas; RSS, Atom e sitemap | `createContentModule`, `createContentRoutes` |
| [`content-ui`](#adatechnologycontent-ui) | painel (lista e editor com prévia ao vivo) e site público (lista, página do post, compartilhar) | `ContentWorkspace`, `PostListPage`, `PostPage` |
| [`content-contracts`](#adatechnologycontent-contracts) | Markdown seguro (servidor e navegador), slug, tempo de leitura, feed e sitemap sem o módulo | `renderMarkdownToHtml`, `parseMarkdown`, `buildRssFeed` |

### Cupons, promoções e captação de contatos (não escreva cupom à mão)

| Pacote | O que resolve | Entrada |
|---|---|---|
| [`coupon-module`](#adatechnologycoupon-module) | campanhas com desconto percentual ou fixo, código fixo, por lead ou em lote, automática; validar, resgatar e liberar idempotente pelo pedido; captação com dedupe; relatórios e exportação CSV/XLSX | `createCouponModule`, `createCouponRoutes` |
| [`coupons-ui`](#adatechnologycoupons-ui) | painel inteiro (lista, editor, códigos, contatos, usos, relatório) e peças do site (campo de cupom, captação, banner) | `CampaignsWorkspace`, `CouponField`, `LeadCaptureDialog`, `CampaignBanner` |
| [`coupon-contracts`](#adatechnologycoupon-contracts) | avaliador puro do desconto (mesma regra no site e no servidor), contato canônico, CSV/XLSX sem dependência | `evaluateCampaign`, `buildCsv`, `buildXlsx` |

### Notificações e modelos de mensagem/e-mail

| Pacote | O que resolve | Entrada |
|---|---|---|
| [`notification-module`](#adatechnologynotification-module) | envio multicanal; **modelos versionados com restaurar padrão**; preferências; supressão | `createNotificationModule` |
| [`notification-ui`](#adatechnologynotification-ui) | sino, inbox, preferências e **editor de modelos com prévia** | `NotificationBell`, `NotificationSettingsWorkspace` |
| [`email-provider`](#adatechnologyemail-provider) | SMTP, Resend ou SES, com bounce e complaint | `createEmailProvider` |
| [`push-provider`](#adatechnologypush-provider) | Expo, FCM e Web Push | `createPushProvider` |
| [`notification-client`](#adatechnologynotification-client) | cliente HTTP, SSE e registro de dispositivo para web e mobile | `createNotificationClient` |

### Conteúdo: blog, novidades e notícias

### @adatechnology/content-contracts
- **Versão:** `0.0.0` (primeira publicação sai `0.1.0` pelo changeset) · `packages/backend/content-contracts`
- **Para quê:** Contratos do trio de conteúdo: post, schemas, erros, portas, e os utilitários puros que servidor e navegador compartilham.
- **O que você ganha:**
  - Markdown → AST fechado (sem nó de HTML cru) e → HTML escapado: `parseMarkdown`, `renderMarkdownToHtml`, `markdownToPlainText`; links só `http(s)`/`mailto`/`tel`/relativo com `rel="noopener noreferrer"`, imagem só `http(s)`/relativo
  - `slugify`, `isValidSlug`, `normalizeTags`, `estimateReadingTimeMinutes`, `buildExcerpt`
  - `buildRssFeed`, `buildAtomFeed`, `buildSitemapXml`, `buildPostUrl` (funções puras, servem site estático)
  - Portas `ContentImageStoragePort` (mesma forma do `ProductImageStoragePort`), `ClockPort`, `LoggerPort`; gancho `onPostChanged`
- **Entradas:** `src/index.ts`
- **Precisa de:** Nenhuma.
- **Compatibilidade:** Isomórfico (Bun, Node, navegador).
- **Usado por:** nenhum ainda.

### @adatechnology/content-module
- **Versão:** `0.0.0` (primeira publicação sai `0.1.0`) · `packages/backend/content-module` · subpaths: `./http/fetch`, `./http/uws`, `./openapi`
- **Para quê:** Blog, novidades e notícias com banco: posts com slug único por empresa, Markdown, capa, tags, SEO, rascunho/agendado/publicado/arquivado.
- **O que você ganha:**
  - Use-cases: criar, editar, arquivar (o "excluir"), publicar agora ou agendar (`publishedAt` futuro fica público no instante, sem cron), despublicar, listar no painel (status/tag/busca, paginado), ler público por slug, listar publicados por tag, listar tags, upload de capa
  - Rotas por `createContentRoutes`: painel com escopo `content:admin` (configurável em `adminScopes`) e `/public/*` sem identidade, empresa resolvida pela porta `PublicCompanyResolverPort`; respostas públicas com `Cache-Control`
  - RSS (`/public/feed.xml`), Atom (`/public/atom.xml`) e entradas de sitemap (`/public/sitemap-entries`) quando há `config.feed`
  - Capacidade por ausência: sem `imageStorage` não há upload; sem `config.feed` não há feed; sem resolver público não há rota pública
  - `createInMemoryPostStore` para teste do host
  - Agendamento que de fato publica: `publishDue({ now })` idempotente e seguro com várias instâncias (`FOR UPDATE SKIP LOCKED`) e `startContentScheduler`; modelos de post, republicar com nova data mantendo o endereço (SEO), recorrência semanal/mensal a partir de modelo, contagem por aba
  - Endereço `<base>/<shortId>-<slug>` com slug automático curto (sem palavras de ligação), histórico de slug para redirecionar link antigo, rótulos de tag
- **Entradas:** `createContentModule` em `src/ContentModule.ts`; `createContentRoutes`; `runContentMigrations`; `contentOpenApiPaths` em `./openapi`
- **Precisa de:** PostgreSQL (Drizzle). Capa por upload: um storage S3 (ex.: `catalog-image-storage-provider`, que tem a mesma forma de porta). Peers: `drizzle-orm`.
- **Compatibilidade:** Drizzle peer `>=0.36.0 <1`; schema `content`; journal `content_migrations` no formato clássico (`meta/_journal.json`).
- **Usado por:** nenhum ainda.

### @adatechnology/content-ui
- **Versão:** `0.0.0` (primeira publicação sai `0.1.0`) · `packages/frontend/content-ui` · subpath: `./styles.css`
- **Para quê:** Telas de blog/novidades com API injetada: painel e site público.
- **O que você ganha:**
  - Painel: `ContentWorkspace` (tela composta), `PostList` (filtros, selos de status ícone+palavra+cor, paginação), `PostEditor` (título, slug, resumo, corpo com barra de formatação — negrito, itálico, títulos, listas, citação, link, imagem (URL ou envio pela API de capa) e emoji, atalhos Ctrl/Cmd+B/I/K — guardando Markdown, com prévia ao vivo; `showFormattingToolbar={false}` esconde a barra; capa por upload ou URL, tags, SEO, publicar/agendar/despublicar/arquivar, aviso de alteração não salva)
  - Público: `PostCard`, `PostListPage` (paginação e filtro de tag por link), `PostPage` (capa, data, tempo de leitura, corpo, compartilhar), `ShareButtons` (WhatsApp, Facebook, X, LinkedIn por URL simples, copiar link, Web Share nativo)
  - Corpo renderizado do AST em elementos React, sem `dangerouslySetInnerHTML`; `buildPostMeta` para o `<head>` do host; `renderLink` para o roteador do host
  - Pontos de customização: `renderDateTimeInput` (seletor de data e hora do host para agendar) e seletor de arquivo estilizado com textos nas mensagens (`coverUpload`, `fileNoneChosen`)
  - Tema por variáveis `--adc-*`; `pt-BR` e `en`; headless `usePostEditor`, `usePostList`, `useUnsavedChangesGuard`
  - Slot opt-in `renderExport({ total, page, pageSize, pageCount, filters })` em `ContentWorkspace`/`PostList`: o host põe o botão de exportar planilha na barra da lista
- **Entradas:** `src/index.ts`
- **Precisa de:** API compatível com `content-module` (interfaces `ContentAdminApi`, `ContentPublicApi`). Peers: `react`, `react-dom`.
- **Compatibilidade:** React 18+.
- **Usado por:** nenhum ainda.

## Agenda e reservas

| Pacote | O que resolve | Entrada |
|---|---|---|
| [`scheduling-module`](#adatechnologyscheduling-module) | recursos, serviços, disponibilidade, reservas sem sobreposição, lembretes | `createSchedulingModule` |
| [`scheduling-ui`](#adatechnologyscheduling-ui) | agenda e administração | `SchedulingWorkspace` |
| [`web-booking-widget`](#adatechnologyweb-booking-widget) | reserva em página externa | `<ada-booking-widget>` |
| [`google-calendar-provider`](#adatechnologygoogle-calendar-provider) | sincronizar com Google Agenda | `createGoogleCalendarProvider` |

### Calendários

| Pacote | O que resolve | Entrada |
|---|---|---|
| [`google-calendar-provider`](#adatechnologygoogle-calendar-provider) | Google Calendar API v3 | `createGoogleCalendarProvider` |
| [`microsoft-calendar-provider`](#adatechnologymicrosoft-calendar-provider) | Microsoft Graph | `createMicrosoftCalendarProvider` |
| [`caldav-calendar-provider`](#adatechnologycaldav-calendar-provider) | iCloud e CalDAV genérico | `createCaldavCalendarProvider` |

### Upload e armazenamento

| Pacote | O que resolve | Entrada |
|---|---|---|
| [`object-storage-provider`](#adatechnologyobject-storage-provider) | S3-compatível com URL assinada de upload e download | `createObjectStorageProvider` |
| [`conversation-module`](#adatechnologyconversation-module) | anexos de conversa com validação de tipo e tamanho | `RequestAttachmentUploadUseCase` |
| [`image-cutout`](#adatechnologyimage-cutout) | recorte de fundo de imagem no navegador | `removeBackground` |
| [`image-editor-ui`](#adatechnologyimage-editor-ui) | editar foto: recorte por formato, girar, espelhar, zoom, brilho/contraste, ponto de foco e texto alternativo | `ImageEditor` |
| [`site-preview-ui`](#adatechnologysite-preview-ui) | **prévia ao vivo do site no painel**: iframe em escala (Computador/Tablet/Celular, zoom, mão, expandir), rola até a seção em edição e a destaca, guarda a rolagem entre recargas | `SitePreview`, `useSitePreviewChannel`, `createPreviewGuest` (subpath `./guest`) |
| [`secret-envelope`](#adatechnologysecret-envelope) | cifrar segredo antes de gravar | `createSecretEnvelopeProvider` |

### Voz: transcrição e moderação

| Pacote | O que resolve | Entrada |
|---|---|---|
| [`audio-transcription-provider`](#adatechnologyaudio-transcription-provider) | áudio em texto (Groq ou whisper.cpp local) | `createGroqTranscriber`, `createTranscriberChain` |
| [`text-moderation`](#adatechnologytext-moderation) | marcar linguagem ofensiva em pt-BR | `createTextModerator` |

### Log e observabilidade

| Pacote | O que resolve | Entrada |
|---|---|---|
| [`logger`](#adatechnologylogger) | log JSON com contexto e redação de campos sensíveis (Bun/Node) | `createLogger`, `redact` |
| [`nestjs-logger`](#adatechnologynestjs-logger) | o mesmo para NestJS | `LoggerModule.forRoot` |
| [`logger-client`](#adatechnologylogger-client) | rastreio de requisição no cliente | `initTraceContext` |
| [`http-client`](#adatechnologyhttp-client) | fetch com retry e cabeçalhos de rastreio | `createHttpClient` |

### Nota fiscal

| Pacote | O que resolve | Entrada |
|---|---|---|
| [`fiscal-provider`](#adatechnologyfiscal-provider) | NFC-e, NF-e, NFS-e, CT-e e SAT direto na SEFAZ | `createFiscalProvider` |

### Pagamentos e assinaturas

| Pacote | O que resolve | Entrada |
|---|---|---|
| [`payment-module`](#adatechnologypayment-module) | assinatura, checkout, webhook idempotente | `createPaymentModule` |
| [`mercadopago-payment-provider`](#adatechnologymercadopago-payment-provider) | Pix, link de cartão e estorno | `createMercadoPagoPaymentProvider` |
| [`hotmart-payment-provider`](#adatechnologyhotmart-payment-provider) | Hotmart (hottok) | `createHotmartPaymentProvider` |

### Delivery (iFood, 99Food, Open Delivery)

| Pacote | O que resolve | Entrada |
|---|---|---|
| [`marketplace-contracts`](#adatechnologymarketplace-contracts) | porta comum e mapeamento de status | `MarketplaceProvider` |
| [`ifood-marketplace-provider`](#adatechnologyifood-marketplace-provider) | iFood | `IfoodMarketplaceProvider` |
| [`food99-marketplace-provider`](#adatechnologyfood99-marketplace-provider) | 99Food | `Food99MarketplaceProvider` |
| [`opendelivery-marketplace-provider`](#adatechnologyopendelivery-marketplace-provider) | padrão Open Delivery | `OpenDeliveryMarketplaceProvider` |

### Contas a pagar

| Pacote | O que resolve | Entrada |
|---|---|---|
| [`expense-module`](#adatechnologyexpense-module) | contas fixas e variáveis, vencimentos, baixa, resumo | `createExpenseModule` |
| [`expense-contracts`](#adatechnologyexpense-contracts) | regras puras, inclusive o fluxo de conversa para lançar conta | `conversation` em `src/` |
| [`expense-mcp`](#adatechnologyexpense-mcp) | o Claude consulta e lança contas | binário do pacote |

### Infra Railway e dados

| Pacote | O que resolve | Entrada |
|---|---|---|
| [`infra-module`](#adatechnologyinfra-module) | ligar e desligar ambientes, agenda e custos | `InfraModule` |
| [`infra-ui`](#adatechnologyinfra-ui) | tela de ambientes e custos | `InfraWorkspace` |
| [`module-http`](#adatechnologymodule-http) | rotas como dado: adaptadores fetch e uWebSockets e OpenAPI | `compileRoutes` |
| [`drizzle-provider`](#adatechnologydrizzle-provider) | conexão Drizzle para Bun SQL | `createDrizzleProvider` |
| [`rabbitmq-provider`](#adatechnologyrabbitmq-provider) | filas RabbitMQ | `createRabbitMqProvider` |

### Documentos brasileiros e logística

| Pacote | O que resolve | Entrada |
|---|---|---|
| [`document-intake`](#adatechnologydocument-intake) | ler CRLV, CNH e CCMEI no navegador | `readCrlv`, `extractCnhFields` |
| [`cargo-placement`](#adatechnologycargo-placement) | empacotar carga no baú | `resolveCargoLayout` |

## Convenções comuns

- **Trio `*-contracts` / `*-module` / `*-ui`:** contratos (tipos, schemas zod e portas, sem runtime), módulo com banco e casos de uso, e interface React. O host injeta o que o pacote não abre sozinho: conexão de banco, config, providers. Nenhum módulo lê `process.env`.
- **Módulos com banco** criam um schema Postgres próprio (`catalog`, `notification`, `user`, `scheduling`, ...) com tabela de journal própria, e nunca tocam o `public` do host. Rodar as migrations é `run<Nome>Migrations({ db, migrate })`.
- **drizzle-orm:** `catalog-module`, `expense-module`, `infra-module` e `scheduling-module` declaram peer `>=0.36.0 <1` (não aceitam drizzle 1.x). Os demais módulos aceitam `<2`. `notification-module` traz dois layouts de migration (`layout: 'v1'` para drizzle 1.x); `conversation-module` e `meta-whatsapp-module` publicam só o formato com pastas de timestamp.
- **zod:** os pacotes de contratos e módulos usam zod 3.x (`^3.24.1`; resolve 3.25.76, a última da linha 3); keycloak-admin e os MCPs usam zod 4 (`^4.6.6`, que traz a correção do GHSA-mrhx-c7xc-m3w5). A linha 3 não tem versão corrigida desse aviso: `.max(n)` num array gigante ainda gera uma issue por elemento. Quem expõe rota pública deve limitar o tamanho do corpo no servidor (ex.: `maxRequestBodySize` do `Bun.serve`) até a migração para zod 4.
- **Rotas HTTP:** os módulos com `createXRoutes` entregam uma tabela de rotas (`module-http`); o host escolhe o adaptador `fetch` ou uWebSockets e gera o OpenAPI da mesma tabela. `conversation-module` não entrega tabela e o `meta-whatsapp-module` entrega só a das respostas rápidas (`createMetaWhatsAppQuickReplyRoutes`): no resto o host monta as rotas.
- **`*-ui`:** nenhum faz `fetch` direto; o host implementa a interface de API do pacote e a injeta num `Provider`.
- **Pacotes sem README:** a entrada foi levantada de `src/index.ts`. Quando for adotar, leia o código antes de confiar.
- `packages/backend/meta-business/catalog` não é pacote: guarda cópia da documentação da Meta Commerce. `packages/backend/example/bun-app` é app de exemplo (ignorado pelo changesets), não biblioteca.

## Atendimento e WhatsApp

### @adatechnology/conversation-contracts
- **Versão:** `0.7.0` · `packages/backend/conversation-contracts`
- **Para quê:** Tipos, schemas zod e portas do núcleo de conversa (agnóstico de canal e de assunto). Só contrato, sem runtime.
- **O que você ganha:**
  - Capacidades por canal (`CHANNEL_CAPABILITIES`, `getChannelCapabilities`) e máquina de status de entrega (`advanceDeliveryStatus`)
  - Corpos de requisição prontos (`OpenConversationBody`, `SendMessageBody`, `QuickReplyBody`) para tipar API e frontend com o mesmo schema
- **Entradas:** `src/index.ts`
- **Precisa de:** Nenhuma (só `zod`).
- **Compatibilidade:** Isomórfico.
- **Usado por:** `transportada`
- **Atenção / não verificado:** Sem README.

### @adatechnology/conversation-module
- **Versão:** `0.4.4` · `packages/backend/conversation-module` · subpaths: `./testing`
- **Para quê:** Núcleo de conversa multicanal com banco: conversas, mensagens, anexos, leitura, mensagens não atribuídas e respostas rápidas, atrás de portas.
- **O que você ganha:**
  - Abrir, receber e enviar mensagem, atualizar status, marcar como lida (`OpenConversationUseCase`, `ReceiveMessageUseCase`, `SendMessageUseCase`, `MarkConversationReadUseCase`)
  - Mensagem inbound sem dono atribuída depois a uma conversa (`AttributeInboundMessageUseCase`, `AssignUnassignedToConversationUseCase`)
  - Upload e download de anexo por URL assinada, com checagem de tipo e tamanho (`RequestAttachmentUploadUseCase`, `CreateAttachmentDownloadUrlUseCase`)
  - Respostas rápidas com ordem (`createQuickReply`, `reorderQuickReplies`)
  - E-mail como canal: endereço de resposta com token (`buildReplyAddress`), cabeçalhos de threading, parser MIME e verificação DKIM (`parseEmailMime`, `createDkimVerifier`)
- **Entradas:** `createConversationModule` em `src/ConversationModule.ts`; `runConversationMigrations` em `src/runMigrations.ts`; `./testing` (fakes para o host)
- **Precisa de:** PostgreSQL (Drizzle). Portas do host: `channels` (um `ConversationChannelPort` por canal que não é e-mail) e `clock`; opcionais `emailTransport`, `objectStorage`, `transcriber`, `filterCandidates`. Peers: `drizzle-orm`.
- **Compatibilidade:** Drizzle peer `>=0.36.0 <2`; migrations em pastas com timestamp (formato do drizzle-kit 1.x, sem `meta/_journal.json`). Não usa `module-http`: não entrega tabela de rotas.
- **Usado por:** nenhum app do workspace declara a dependência
- **Atenção / não verificado:** Sem README. Núcleo genérico multicanal; nenhum app do workspace o consome hoje. O produto que fala WhatsApp pela Meta usa `meta-whatsapp-module`, que tem o próprio schema de sessões e mensagens: não são o mesmo módulo.

### @adatechnology/meta-whatsapp-contracts
- **Versão:** `0.6.1` · `packages/backend/meta-whatsapp-contracts` · subpaths: `./testing`
- **Para quê:** Contratos do trio WhatsApp Meta: schemas zod do webhook, tipos do grafo de fluxo, portas de canal e erros. Só contrato.
- **O que você ganha:**
  - Schemas do webhook da Meta (`whatsAppWebhookPayloadSchema`, mensagens, status, qualidade, template)
  - Modelo do grafo de fluxo compartilhado com o editor visual: nós `question`, `entrada_choice`, `action`, `menu`, `condition`; ações `handoff`, `rate_limited_handoff`, `send_product_list`, `send_media`; salto entre fluxos `flow:<chave>` (`FLOW_ACTION_KIND`, `flowGraphNodesSchema`, `isCrossFlowTarget`)
  - Limites do WhatsApp para botões e listas (`WHATSAPP_CHOICE_LIMIT`)
  - **Respostas rápidas** (a publicar na 0.7.0): `whatsAppQuickReplyInputSchema`, `listWhatsAppQuickRepliesQuerySchema`, `WhatsAppQuickReply`, limites (`QUICK_REPLY_LIMITS`: título 40, atalho 20, texto 1000, 500 por empresa), `QUICK_REPLY_SHORTCUT_PATTERN` e erros `QuickReplyNotFoundError` (404), `QuickReplyShortcutTakenError` (409) e `QuickReplyLimitReachedError` (422)
  - `./testing`: builders de payload inbound (`buildInboundTextPayload`, `buildInboundInteractivePayload`, `buildInboundAudioPayload`, `buildInboundMediaPayload`) que rodam também no navegador e alimentam o simulador
- **Entradas:** `src/index.ts`; `src/flow.types.ts`; `src/testing/inboundPayloads.ts`
- **Precisa de:** Nenhuma.
- **Compatibilidade:** Isomórfico (o `./testing` não toca `node:crypto`).
- **Usado por:** `ada-technology`, `comandada`, `quickcart`, `transportada`, `financing-chatbot`, `supermercado-noemia`
- **Atenção / não verificado:** Sem README.

### @adatechnology/meta-whatsapp-module
- **Versão:** `0.8.1` · `packages/backend/meta-whatsapp-module` · subpaths: `./testing`
- **Para quê:** Módulo de atendimento pela WhatsApp Cloud API, com banco: webhook, sessões, mensagens, **motor de fluxos (robô)**, takeover humano, mídia e transcrição.
- **O que você ganha:**
  - Webhook com verificação de assinatura, desafio de verificação e deduplicação idempotente (`ReceiveWebhookUseCase`, `verifyWebhookSignature`, `claimWebhookDelivery`)
  - **Motor de fluxos:** `FlowInterpreter` executa o grafo (`question`, `entrada_choice`, `menu`, `condition`, `action`) com contexto, salto entre fluxos e limite de passos; ações plugáveis (`createSendProductListAction`, `createSendMediaAction`, handoff)
  - Grafos de fluxo persistidos com lock otimista e cache opcional (`FlowGraphRepository`, `Create/Save/Get/List/DeleteFlowGraphUseCase`); `GetLiveFlowPositionsUseCase` mostra em que nó cada conversa está
  - **Runner de fluxo** (`features.flowRunner`): pergunta de horário (`questionType: 'time'`, faixas permitidas pelo contexto), validador do host (`validateAnswer`), textos do bot resolvidos por empresa/conversa (`FlowConfigText`: string ou `(ctx) => string | undefined`), escolha digitada casada com o título já interpolado, `listButtonLabel` (nó ou config) com `{{chave}}`
  - **Origem do grafo (`origin: 'seed' | 'edited'`, `seedVersion`):** o produto atualiza grafos semeados que ninguém editou com `module.flows.reseed` (`ReseedFlowGraphUseCase`; troca só `seed` de outra versão, nunca toca `edited`, idempotente por `seedVersion`)
  - **Retentativa do envio do robô** (`flowRunner.sendRetry`: tentativas, backoff exponencial, `shouldRetry`; só falha de rede, mensagem a mensagem, sem reenviar o que já saiu); falha final chega em `onFlowRunnerError` com `details.send`
  - Histórico de mensagens com cursor composto `(created_at, id)`: `ListMessagesUseCase`/`MessageRepository.listByConversation` aceitam `beforeId` (cursor lido da própria linha, em microssegundos)
  - Takeover humano e devolução ao robô (`TakeoverConversationUseCase`, `ReleaseConversationUseCase`)
  - **Respostas rápidas por empresa** (a publicar na 0.12.0; só texto, sem anexos): tabela `meta_whatsapp.quick_replies` (atalho único por empresa, ordem por `sortOrder`), `module.quickReplies.{list,create,update,delete}` e `createMetaWhatsAppQuickReplyRoutes({ module, scopes? })` (`module-http`): `GET`/`POST /quick-replies`, `PUT`/`DELETE /quick-replies/:id`. Leitura para qualquer agente autenticado; escrita exige `quick-replies:write` (`QUICK_REPLY_SCOPE`; vocabulário do host em `scopes`). O painel liga pelo `createMetaWhatsAppQuickRepliesClient` do `conversations-ui`
  - Tempo real por SSE com ticket (`SseHub`, `issueSseTicket`); eventos em `conv:<número>` trazem `companyId`
  - Mídia inbound no storage e áudio transcrito em `auto` ou `onDemand` (`IngestInboundMediaUseCase`, `TranscribeAudioUseCase`)
  - Suporte ao simulador: `features.previewMedia` aceita mídia `preview-upload:<chave>` vinda do preview (desligado por padrão: em produção seria leitura arbitrária do bucket)
  - LGPD: `features.redactInboundLocation`, exportar e excluir conversa, purga de documentos expirados
  - Marcação de mensagem ofensiva via `providers.moderator` (ver `text-moderation`)
- **Entradas:** `createMetaWhatsAppModule` em `src/createMetaWhatsAppModule.ts`; `FlowInterpreter` em `src/flows/FlowInterpreter.ts`; `WhatsAppChannelAdapter` em `src/channel/WhatsAppChannelAdapter.ts`; `runMetaWhatsAppMigrations` em `src/runMigrations.ts`; `./testing`: builders de payload inbound para scripts e testes
- **Precisa de:** PostgreSQL (Drizzle). Config: `phoneNumberId`, `accessToken`, `webhookVerifyToken`, `appSecret` (o módulo não lê `process.env`). Providers opcionais: `objectStorage` (com `getObject`, para transcrição sob demanda e preview), `cache` (Redis do host, para cache de grafos), `realtime`, `subjectResolver`, `catalog` (`CatalogPort`, habilita `send_product_list`), `moderator`, `transcription`. `features.flowEngine=false` desliga o motor para quem conduz a conversa por código próprio. Peers: `drizzle-orm`.
- **Compatibilidade:** Drizzle peer `>=0.36.0 <2` (o tipo de `db` checa hosts 0.x contra `MetaWhatsAppDatabaseShape`, em vez de cair em `any`); schema `meta_whatsapp`; migrations em pastas com timestamp (formato 1.x). Não entrega tabela de rotas: o host monta webhook e rotas HTTP.
- **Usado por:** `ada-technology`, `comandada`, `quickcart`, `transportada`, `financing-chatbot`, `supermercado-noemia`
- **Atenção / não verificado:** Sem README: capacidades levantadas de `src/index.ts` e do código. O editor visual do grafo é `conversations-ui/flows` e o simulador de cliente é `conversations-ui/preview`.

### @adatechnology/meta-whatsapp-provider
- **Versão:** `0.4.0` · `packages/backend/meta-whatsapp-provider`
- **Para quê:** Cliente da WhatsApp Cloud API (Meta): mensagens, templates e conversão de áudio de saída.
- **O que você ganha:**
  - `WhatsAppMessageProvider` (envio) e `WhatsAppTemplateProvider` (templates)
  - `normalizeOutboundAudio` e `createFfmpegTranscoder`: convertem áudio para o formato aceito pelo WhatsApp
  - Erros tipados (`WhatsAppWindowExpiredError`, `WhatsAppRejectionError`, `WhatsAppTemplateDuplicateError`)
- **Entradas:** `createWhatsAppProvider` em `src/index.ts`
- **Precisa de:** Token e `phoneNumberId` da Meta; `ffmpeg` no host só para transcodificar áudio.
- **Compatibilidade:** Bun/Node.
- **Usado por:** `ada-technology`, `comandada`, `quickcart`, `transportada`, `financing-chatbot`, `supermercado-noemia`, `reservada`
- **Atenção / não verificado:** Sem README.

### @adatechnology/meta-graph-core
- **Versão:** `0.3.0` · `packages/backend/meta-graph-core`
- **Para quê:** Base comum das APIs Graph da Meta: cliente HTTP, erros, validação de resposta e assinatura de webhook.
- **O que você ganha:**
  - `graphFetch`, `buildGraphUrl`, `parseGraphResponse`
  - `isValidWebhookSignature`, `isValidWebhookChallenge`, `buildWebhookDeliveryKey`
  - Erros (`MetaGraphError`, `isDeterministicMetaRejection`)
- **Entradas:** `src/index.ts`
- **Precisa de:** Token da Meta.
- **Compatibilidade:** Bun/Node.
- **Usado por:** `ada-technology`, `financing-chatbot`
- **Atenção / não verificado:** Sem README.

### @adatechnology/evolution-whatsapp-provider
- **Versão:** `0.3.0` · `packages/backend/evolution-whatsapp-provider`
- **Para quê:** Cliente da Evolution API (WhatsApp não oficial, auto-hospedado) com o mesmo contrato de canal do provider da Meta.
- **O que você ganha:**
  - Texto, mídia, estado da conexão e leitura de webhook (`parseEvolutionWebhook`, `verifyEvolutionWebhookSecret`)
  - Grupos: enviar para `@g.us` e detectar menção ao bot (`evolutionMentionsNumber`)
- **Entradas:** `EvolutionWhatsAppChannel` em `src/index.ts`
- **Precisa de:** Instância própria da Evolution API. A Meta não autoriza esse protocolo: o número pode ser banido (aviso do README).
- **Compatibilidade:** Bun/Node.
- **Usado por:** `transportada`

### @adatechnology/conversations-ui
- **Versão:** `0.17.0` · `packages/frontend/conversations-ui` · subpaths: `./flows`, `./whatsapp`, `./preview`, `./participant`, `./styles.css`
- **Para quê:** Interface de atendimento (inbox, conversa no desenho do WhatsApp, documentos, respostas rápidas, templates), **editor visual de fluxos** e **simulador de conversa**.
- **O que você ganha:**
  - **Simulador de conversa sem a Meta:** `ConversationSimulatorPanel` e `ConversationPreview` (moldura com título, telefone, mídia e gravação de áudio) ligados a um transporte. `createPreviewBridgeClient` é o recomendado: manda um comando semântico (`text`, `buttonReply`, `listReply`, `audio`, `media`) a uma rota do próprio host, que monta e assina o payload, sem segredo no bundle. `createPreviewWebhookClient` assina HMAC no navegador e serve só para execução local
  - **Novo contato de teste no workspace:** `simulator.createTestContact` abre o simulador sem conversa selecionada; número de teste (dígitos começando com `0`) aparece como "Contato de teste 1234", não como telefone (`isTestContactNumber`). `contextLabels` troca os rótulos do painel de contexto embutido
  - Dados de demonstração: `createMockConversationsApi`, `createMockSSEProvider`, `PREVIEW_CONVERSATIONS`, `startPreviewScript`
  - **Editor visual de fluxos (robô):** `FlowsWorkspace` (tela completa; o host implementa `FlowsWorkspaceApi`) e as peças `FlowMapCanvas`, `FlowPalette`, `FlowNodePanel`, `FlowLegend`, `validateGraph`, `computeAutoLayout`; **prévia no desenho do WhatsApp** em `FlowWhatsAppPreview`; posições vivas das conversas no mapa (`countLiveByNode`); `validateGraph` mede rótulo de botão/linha/botão de lista com `{{variável}}` sobre o exemplo da variável (`variableExamples`, também prop de `FlowsWorkspace`) e só avisa quando falta exemplo; campos de horário (`minTime`/`maxTime`/faixas) e `possibleNext` (destinos que uma action pode devolver, desenhados tracejados)
  - Histórico paginado por cursor composto: `fetchMessages` recebe `before` + `beforeId` (mensagem mais antiga da tela), então mensagens no mesmo instante não somem nem se repetem
  - Inbox e conversa: `ConversationsWorkspace`, `ConversationPane`, `MessageBubble`, `MessageComposer`, `RichMessageComposer`, `AudioRecorderButton`, `AudioTranscription`, `InteractiveMessage` (botões e listas), `WindowExpiredNotice` (janela de 24 h)
  - Respostas rápidas (`QuickRepliesWorkspace`, `QuickRepliesPicker`), documentos (`DocumentsLibrary`, `DocumentsWorkspace`), configuração de templates do WhatsApp (`WhatsAppTemplatesSettings`, `WhatsAppCreateTemplateForm`), boas-vindas e despedida (`WelcomeFarewellForm`), transcrição (`TranscriptionSettingsForm`)
  - **Cliente das respostas rápidas do módulo:** `createMetaWhatsAppQuickRepliesClient({ baseUrl, getHeaders? })` devolve `listQuickReplies`, `createQuickReply`, `updateQuickReply` e `deleteQuickReply` prontos para espalhar em `ConversationsApi` ou passar ao `QuickRepliesWorkspace`/`QuickRepliesPicker`; desembrulha `{ data }`, traduz a validação para `details` por campo e propaga `QUICK_REPLY_SHORTCUT_TAKEN` (`QuickRepliesApiError`). Só texto: sem a porta de anexos, a tela não oferece anexos (a publicar na 0.18.0)
  - `./participant`: a conversa vista por quem participa (`ParticipantConversations`, `ConversationThread`), com adapter REST
  - Tema por variáveis CSS, modo escuro (`useDarkMode`), textos por `ConversationLocalesProvider`
  - Slot opt-in `renderExport({ total, page, pageSize, pageCount, filters })` em `DocumentsWorkspace` para o botão de exportar planilha do host (a lista de conversas já tem `renderFilters(inbox)`)
- **Entradas:** `ConversationSimulatorPanel` em `src/preview/ConversationSimulatorPanel.tsx`; `createPreviewBridgeClient` em `src/preview/createPreviewBridgeClient.ts`; `FlowsWorkspace` em `src/flows/FlowsWorkspace.tsx`; `FlowWhatsAppPreview` em `src/flows/FlowWhatsAppPreview.tsx`; `ConversationsWorkspace` em `src/workspace/`; Subpaths: `./flows`, `./preview`, `./participant`, `./styles.css` (`./whatsapp` existe no `exports`, mas hoje não exporta nada)
- **Precisa de:** API REST do host injetada por `ConversationsProvider` (tipo `ConversationsApi` em `src/providers/types.ts`) e SSE. O lado servidor do simulador é do host: uma rota que receba o comando e entregue ao `meta-whatsapp-module` o webhook assinado (builders em `meta-whatsapp-contracts/testing`). `@xyflow/react` é peer do editor de fluxos. Peers: `@xyflow/react`, `react`, `react-dom`.
- **Compatibilidade:** React 18+, ESM, CSS em `./styles.css`; Tailwind do host.
- **Usado por:** `ada-technology`, `comandada`, `quickcart`, `transportada`, `supermercado-noemia`, `financing-chatbot`
- **Atenção / não verificado:** O README tem 41 KB, centrado na visão do participante. O ADR `docs/adr/0002-flows-workspace.md` registra que o `financing-chatbot` ainda mantém fork local das peças do editor.

### @adatechnology/web-chat-widget
- **Versão:** `0.1.0` · `packages/frontend/web-chat-widget` · subpaths: `./simulator`
- **Para quê:** Chat de site como Web Component nativo, sem framework, em shadow DOM fechado.
- **O que você ganha:**
  - Elemento customizado registrado ao importar (`registerAdaChatWidget`, `WIDGET_TAG_NAME`); o atributo `api-base` é obrigatório
  - `./simulator`: `createWebChatSimulatorClient`, um transporte do simulador de conversa para o canal de chat web
- **Entradas:** `AdaChatWidget` em `src/AdaChatWidget.ts`; `createWebChatSimulatorClient` em `src/simulator/createWebChatSimulatorClient.ts`
- **Precisa de:** API do produto hospedeiro, que confere o `Origin`.
- **Compatibilidade:** Qualquer página; sem React.
- **Usado por:** `ada-technology`

### @adatechnology/audio-transcription-provider
- **Versão:** `0.1.0` · `packages/backend/audio-transcription-provider` · subpaths: `./whisper-local`
- **Para quê:** Fala em texto: Groq/Whisper hospedado por padrão, whisper.cpp local opcional, encadeáveis.
- **O que você ganha:**
  - `createGroqTranscriber` (usa `fetch`, sem dependências)
  - `createTranscriberChain`: engine de reserva por configuração
  - `./whisper-local`: `createWhisperLocalTranscriber` (modelo ggml local)
  - `collapseRepetitions` contra loops de repetição do Whisper
- **Entradas:** `src/index.ts`; `./whisper-local`
- **Precisa de:** Chave Groq passada por parâmetro (o pacote não lê `process.env`); o engine local exige `whisper-cli`, `ffmpeg` e modelo no disco.
- **Compatibilidade:** Node 18+ e Bun. Standalone: não depende de pacotes WhatsApp.
- **Usado por:** `ada-technology`, `quickcart`, `transportada`, `supermercado-noemia`, `entrelacos`, `ativada`

### @adatechnology/text-moderation
- **Versão:** `0.2.0` · `packages/backend/text-moderation`
- **Para quê:** Detecção de linguagem ofensiva em pt-BR, extensível pelo produto.
- **O que você ganha:**
  - `createTextModerator` com `extraTerms`, `allowedTerms` e `isEnabled`
  - Casamento por palavra: nomes como Paulo e Paula nunca são marcados
- **Entradas:** `createTextModerator`, `parseTermList` em `src/index.ts`
- **Precisa de:** Nenhuma.
- **Compatibilidade:** Isomórfico, sem log nem I/O.
- **Usado por:** `quickcart`, `supermercado-noemia`

### @adatechnology/audio-transcription-mcp
- **Versão:** `0.1.0` · `packages/mcp/audio-transcription-mcp`
- **Para quê:** Servidor MCP que expõe transcrição Whisper local como ferramenta.
- **O que você ganha:**
  - Transcrever arquivo de áudio sem chave de API e sem upload
- **Entradas:** `claude mcp add ada-transcription -- bunx @adatechnology/audio-transcription-mcp`
- **Precisa de:** `whisper-cli`, `ffmpeg` e modelo ggml (README recomenda `large-v3-turbo`).
- **Compatibilidade:** Bun/Node.
- **Usado por:** nenhum app do workspace declara a dependência

## Notificações e e-mail

### @adatechnology/notification-contracts
- **Versão:** `0.5.0` · `packages/backend/notification-contracts`
- **Para quê:** Contratos do trio de notificações: entidades, canais, portas de driver e do host, schemas zod, eventos.
- **O que você ganha:**
  - Canais `inbox`, `push`, `email`, `whatsapp` (`NOTIFICATION_CHANNEL`)
  - Portas `PushDriverPort`, `EmailDriverPort`, `WhatsAppDriverPort`, `RecipientResolverPort`, `QueuePort`, `RealtimeNotifierPort`
  - Limites de anexo de e-mail (`checkEmailAttachment`) e schemas de web push
- **Entradas:** `src/index.ts`
- **Precisa de:** Nenhuma.
- **Compatibilidade:** Isomórfico.
- **Usado por:** `ada-technology`, `quickcart`, `transportada`, `supermercado-noemia`, `entrelacos`

### @adatechnology/notification-module
- **Versão:** `0.6.0` · `packages/backend/notification-module` · subpaths: `./queue/bullmq`, `./queue/amqp`, `./openapi`, `./testing`
- **Para quê:** Notificação multicanal (inbox, push, e-mail, WhatsApp) com banco, preferência por usuário, silêncio, deduplicação, agendamento, retry e supressão.
- **O que você ganha:**
  - Enviar para vários canais numa chamada (`SendNotificationUseCase`), com worker e cron prontos (`createNotificationWorker`, `createNotificationSchedules`)
  - **Modelos de mensagem versionados:** `UpsertTemplateUseCase`, `SeedDefaultTemplatesUseCase`; e-mail padrão `notification.standard-email` com **restaurar padrão**, que grava versão nova e mantém o histórico (`module.standardEmail.restoreDefault`)
  - Inbox com contador e SSE; preferências e políticas por categoria; dispositivos de push
  - Supressão por bounce e complaint (a chave é o HMAC do endereço, nunca o e-mail em claro)
  - Rotas HTTP prontas (`createNotificationRoutes`) para `Bun.serve` e uWebSockets via `module-http`; OpenAPI em `./openapi`. **Escopos exigidos:** `notification:admin` nas rotas `admin` e `notification:send` (ou admin) no envio por máquina (`NOTIFICATION_SCOPE`; vocabulário do host via `scopes`)
  - Fila é porta: adaptadores BullMQ (`./queue/bullmq`) e AMQP (`./queue/amqp`)
- **Entradas:** `createNotificationModule` em `src/NotificationModule.ts`; `createNotificationRoutes` em `src/http/routes.ts`; `createNotificationWorker` em `src/worker`; `runNotificationMigrations`
- **Precisa de:** PostgreSQL (Drizzle); drivers injetados (`email-provider`, `push-provider`, WhatsApp); fila opcional (BullMQ/Redis ou RabbitMQ). Peers: `drizzle-orm`.
- **Compatibilidade:** Drizzle peer `>=0.36.0 <2`; schema `notification`; **dois layouts de migration**: journal (drizzle-orm 0.x) e `migrations-v1` (1.x). Host com drizzle-orm 1.x passa `layout: 'v1'`.
- **Usado por:** `ada-technology`, `quickcart`, `transportada`, `supermercado-noemia`, `entrelacos`

### @adatechnology/email-provider
- **Versão:** `0.1.5` · `packages/backend/email-provider`
- **Para quê:** E-mail por SMTP, Resend ou SES atrás de uma porta, com parsers de bounce e complaint.
- **O que você ganha:**
  - `createEmailProvider({ driver })` ou fábricas diretas por driver
  - `parseResendWebhook`, `parseSesNotification` (recibos)
  - `buildMimeMessage` e anexos por URL (`fetchAttachments`)
- **Entradas:** `src/index.ts`
- **Precisa de:** Credenciais do driver; peers opcionais `nodemailer`, `resend`, `@aws-sdk/client-sesv2`. Peers: `nodemailer`, `resend`, `@aws-sdk/client-sesv2`.
- **Compatibilidade:** Bun/Node. Stateless.
- **Usado por:** `ada-technology`, `quickcart`, `transportada`, `supermercado-noemia`

### @adatechnology/push-provider
- **Versão:** `0.2.1` · `packages/backend/push-provider`
- **Para quê:** Push por Expo, FCM e Web Push (VAPID) atrás de uma porta.
- **O que você ganha:**
  - `createPushProvider({ driver })`
  - Expo em lote, FCM e Web Push com criptografia RFC 8291 (`generateVapidKeys`)
- **Entradas:** `src/index.ts`
- **Precisa de:** `firebase-admin` (peer opcional) só para FCM; chaves VAPID para web push. Peers: `firebase-admin`.
- **Compatibilidade:** Bun/Node. Stateless.
- **Usado por:** `transportada`, `entrelacos`

### @adatechnology/notification-client
- **Versão:** `0.4.0` · `packages/frontend/notification-client`
- **Para quê:** Cliente isomórfico das rotas de notificação: HTTP tipado, registro de dispositivo e stream em tempo real.
- **O que você ganha:**
  - `createNotificationClient`, `subscribeToNotificationStream` (SSE)
  - Web Push (`subscribeWebPush`) e Expo (`createExpoPushRegistration`)
- **Entradas:** `src/index.ts`
- **Precisa de:** API do `notification-module`.
- **Compatibilidade:** React Native, web, Node e Bun.
- **Usado por:** `ada-technology`, `quickcart`, `transportada`, `entrelacos`, `supermercado-noemia`

### @adatechnology/notification-ui
- **Versão:** `0.6.4` · `packages/frontend/notification-ui` · subpaths: `./headless`, `./styles.css`
- **Para quê:** Interface de notificações (sino, inbox, preferências) e tela de administração dos modelos de mensagem.
- **O que você ganha:**
  - `NotificationProvider`, `NotificationBell`, `NotificationList`, `PreferencesPanel`, `NotificationsWorkspace`
  - `NotificationSettingsWorkspace`: editor de modelos com editor de código HTML para e-mail, barra de formatação e `TemplatePreview` (prévia com moldura)
  - Camada headless em `./headless`
- **Entradas:** `src/index.ts`; `./headless`; `./styles.css`
- **Precisa de:** API compatível com `notification-module`, via `notification-client`. Peers: `@tanstack/react-query`, `react`, `react-dom`.
- **Compatibilidade:** React 18+, peer `@tanstack/react-query`.
- **Usado por:** `ada-technology`, `quickcart`, `transportada`, `entrelacos`, `supermercado-noemia`

## Usuários, identidade e segurança

### @adatechnology/user-contracts
- **Versão:** `0.2.0` · `packages/backend/user-contracts`
- **Para quê:** Contratos de autenticação e usuário: tipos, schemas, erros, eventos e portas.
- **O que você ganha:**
  - Tipos de usuário e avatar, eventos e portas de provedor de autenticação
- **Entradas:** `src/index.ts`
- **Precisa de:** Nenhuma.
- **Compatibilidade:** Isomórfico.
- **Usado por:** `ada-technology`, `quickcart`, `transportada`, `supermercado-noemia`, `entrelacos`
- **Atenção / não verificado:** Sem README.

### @adatechnology/user-module
- **Versão:** `0.4.0` · `packages/backend/user-module` · subpaths: `./schema`, `./http/fetch`, `./http/uws`, `./openapi`
- **Para quê:** Autenticação local e Keycloak, sessão com refresh, reset de senha e perfil, com banco.
- **O que você ganha:**
  - Login local e via Keycloak (`AuthenticateLocalUseCase`, `AuthenticateKeycloakUseCase`)
  - Criar usuário, perfil e listar equipe (`CreateUserUseCase`, `UpdateProfileUseCase`, `ListUsersUseCase`)
  - Sessão com refresh token e cookie (`RefreshSessionUseCase`, `SignOutUseCase`)
  - Reset de senha por e-mail (`RequestPasswordResetUseCase`, `ConfirmPasswordResetUseCase`)
  - Administrador define a senha de outra pessoa (`PUT /admin/users/:id/password`, `SetUserPasswordUseCase`): revoga as sessões dela, auditado por `onPasswordChanged` com `changedByUserId`
  - Cookie de refresh com `sameSite` `lax` (padrão), `none` ou `strict`
  - Avatar por storage injetável
  - "Lembrar de mim" opcional no login: `rememberMe` + `refreshToken.rememberExpiresInSeconds` / `sessionExpiresInSeconds`; a escolha fica gravada no refresh token (servidor) e `refreshToken.absoluteExpiresInSeconds` põe teto absoluto na sessão; `parseRefreshCookieValue` exportado
  - Bloqueio progressivo por tentativas falhas (`config.lockout`): `lockMultiplier`, `maxLockMinutes`, `forgiveAfterMinutes` (padrão sem escalada: duração fixa) e `identifierSecret`, que bloqueia também e-mail inexistente (grava só o HMAC). Usa `login-lockout`; migration `0004` acrescenta `lock_level`, `last_failed_login_at` e `user.login_lockouts`
  - Rotas prontas (`createUserRoutes`; adaptadores `./http/fetch`, `./http/uws`, `./openapi`)
- **Entradas:** `createUserModule` em `src/UserModule.ts`; `createUserRoutes` em `src/http/`; `runUserMigrations`
- **Precisa de:** PostgreSQL (Drizzle). Providers opcionais: `refreshTokenStore`, `email` (reset de senha), `keycloak` (verificador), `avatar`. Peers: `drizzle-orm`.
- **Compatibilidade:** Drizzle peer `>=0.36.0 <2`; schema `user`; migrations com `meta/_journal.json`.
- **Usado por:** `ada-technology`, `quickcart`, `transportada`, `supermercado-noemia`, `entrelacos`
- **Atenção / não verificado:** Sem README no `user-contracts`; o `user-module` documenta o lockout no próprio README.

### @adatechnology/login-lockout
- **Versão:** `0.1.0` (nova) · `packages/backend/login-lockout` · subpath: `./drizzle`
- **Para quê:** Bloqueio progressivo de login para qualquer app (convidado por telefone, equipe por e-mail, PIN): cada bloqueio dura o dobro do anterior até um teto, e um dia sem falhas perdoa.
- **O que você ganha:**
  - `createLoginLockout({ store, secret, policy? })`: `check`, `assertNotLocked` (lança `LoginLockedError` genérico com `retryAfterSeconds`), `registerFailure`, `clear`
  - Identificador desconhecido bloqueia igual ao real; só o HMAC é gravado (nunca telefone ou e-mail); chave por combinação (`[ip, telefone]`)
  - `./drizzle`: `createDrizzleLockoutStore`, tabela `loginLockouts` (ou `loginLockoutColumns()` dentro do seu `pgSchema`); atualização atômica (`FOR UPDATE`)
  - Política pura exportada (`applyFailure`, `lockMinutesForLevel`, `resolveLockoutPolicy`) e `createInMemoryLockoutStore` para teste
- **Entradas:** `src/index.ts`; `src/drizzle/index.ts`
- **Precisa de:** PostgreSQL (Drizzle) para o armazenamento persistente; a migration da tabela é do host (o `user-module` já a traz).
- **Compatibilidade:** Bun/Node; peer opcional `drizzle-orm` `>=0.36.0 <2`.
- **Usado por:** `user-module`

### @adatechnology/user-ui
- **Versão:** `0.2.0` · `packages/frontend/user-ui`
- **Para quê:** Telas de login, recuperação de senha, perfil e gestão de equipe, com API injetada.
- **O que você ganha:**
  - `UserWorkspace`, `SignInScreen`, `ForgotPasswordScreen`, `ResetPasswordScreen`, `ProfileEditForm`, `ChangePasswordForm`
  - `SignInScreen showRememberMe` (caixa "Lembrar de mim", opt-in)
  - `TeamWorkspace` define a senha de outra pessoa quando a `UserApi` traz `setTeamMemberPassword` (`TeamMemberPasswordForm`)
  - `TeamWorkspace` (equipe e papéis via `buildDefaultTeamRoles`), `AvatarPicker` com recorte de fundo (`image-cutout`)
  - Slot opt-in `renderExport({ total, page, pageSize, pageCount, filters })` em `TeamWorkspace` para o botão de exportar planilha do host
- **Entradas:** `src/index.ts`
- **Precisa de:** API compatível com `user-module` (`UserProvider`, `useUserApi`). Peers: `react`, `react-dom`.
- **Compatibilidade:** React 18+.
- **Usado por:** `ada-technology`, `quickcart`, `supermercado-noemia`
- **Atenção / não verificado:** Sem README.

### @adatechnology/keycloak-jwt
- **Versão:** `0.1.1` · `packages/backend/keycloak-jwt`
- **Para quê:** Verificação estrita de access token do Keycloak (JWKS remoto) para aplicações Bun.
- **O que você ganha:**
  - `createKeycloakJwtVerifier` exige `iss`, `aud`, `exp`, `sub`, `kid` e algoritmo permitido; aceita `requiredClaims`
- **Entradas:** `src/index.ts`
- **Precisa de:** Keycloak (URL do realm e JWKS).
- **Compatibilidade:** Bun, ESM; usa `jose`.
- **Usado por:** `transportada`

### @adatechnology/keycloak-admin
- **Versão:** `1.0.1` · `packages/backend/keycloak-admin`
- **Para quê:** Cliente da Admin API do Keycloak autenticado como service account (`client_credentials`).
- **O que você ganha:**
  - `createKeycloakAdminClient`: gestão de usuários e atributos (inclui foto de perfil), sem usar senha de administrador
- **Entradas:** `src/index.ts`
- **Precisa de:** Client confidencial com `manage-users` no realm. Peers: `zod`.
- **Compatibilidade:** Qualquer runtime com `fetch`; peer `zod`.
- **Usado por:** `transportada`

### @adatechnology/identity-reconciliation
- **Versão:** `0.1.0` · `packages/backend/identity-reconciliation`
- **Para quê:** Regras puras para casar a base de usuários do produto com o realm do provedor de identidade.
- **O que você ganha:**
  - `reconcileIdentities`, `summarizeReconciliation`, `partitionByExistence` (por documento e e-mail)
- **Entradas:** `src/index.ts`
- **Precisa de:** Nenhuma (puro).
- **Compatibilidade:** Isomórfico.
- **Usado por:** `transportada`

### @adatechnology/secret-envelope
- **Versão:** `0.1.0` · `packages/backend/secret-envelope`
- **Para quê:** Envelope autenticado e versionado para segredos (AES-256-GCM via Web Crypto).
- **O que você ganha:**
  - `createSecretEnvelopeProvider`: cifra e decifra com AAD obrigatório e id de chave
- **Entradas:** `src/index.ts`
- **Precisa de:** Chave de 32 bytes fornecida pelo host.
- **Compatibilidade:** Bun (Web Crypto).
- **Usado por:** `transportada`

### @adatechnology/auth-keycloak
- **Versão:** `1.0.0` · `packages/backend/auth-keycloak`
- **Para quê:** Verificação de JWT do Keycloak com JWKS em cache e middleware HTTP, sem NestJS.
- **O que você ganha:**
  - `verifyToken`, `createKeycloakMiddleware`, `getRequestUser`
- **Entradas:** `src/index.ts`
- **Precisa de:** Keycloak; peer `@adatechnology/logger`. Peers: `@adatechnology/logger`.
- **Compatibilidade:** Bun, Node e uWebSockets.js. Para Bun novo, `keycloak-jwt` é a verificação estrita.
- **Usado por:** nenhum app do workspace declara a dependência

### @adatechnology/nestjs-auth-keycloak
- **Versão:** `0.1.25` · `packages/backend/nestjs-auth-keycloak`
- **Para quê:** Módulo NestJS de autenticação Keycloak: cliente de token, guards e decorators de papel.
- **O que você ganha:**
  - `KeycloakModule.forRoot`, `BearerTokenGuard` (introspecção), `RolesGuard`, `Roles`, `B2BGuard`, `B2CGuard`, `AuthUser`
- **Entradas:** `src/index.ts`
- **Precisa de:** Keycloak; depende de `nestjs-http-client`, `nestjs-cache` e `nestjs-logger`. Peers: `@nestjs/common`, `@nestjs/core`.
- **Compatibilidade:** NestJS (peers `@nestjs/common`, `@nestjs/core`).
- **Usado por:** nenhum app do workspace declara a dependência
- **Atenção / não verificado:** O README cita nomes antigos de pacote nos imports: confira os nomes reais no `package.json`.

### @adatechnology/nestjs-keycloak-admin
- **Versão:** `0.1.23` · `packages/backend/nestjs-keycloak-admin`
- **Para quê:** Cliente NestJS da Admin API do Keycloak (autentica como usuário administrador do realm `master`).
- **O que você ganha:**
  - `KeycloakAdminModule`, `KeycloakAdminClient`
- **Entradas:** `src/index.ts`
- **Precisa de:** Keycloak; `nestjs-http-client`. Peers: `@nestjs/common`, `@nestjs/core`.
- **Compatibilidade:** NestJS. Para service account sem senha de administrador, use `keycloak-admin`.
- **Usado por:** nenhum app do workspace declara a dependência
- **Atenção / não verificado:** Sem README.

## Cadastros, catálogo e produtos

### @adatechnology/customer-contracts
- **Versão:** `0.1.1` · `packages/backend/customer-contracts`
- **Para quê:** Contratos do cadastro de clientes: tipos, schemas, erros e portas.
- **O que você ganha:**
  - Catálogo de campos declarável pelo produto; tipos de cliente, endereço e documento
- **Entradas:** `src/index.ts`
- **Precisa de:** Nenhuma.
- **Compatibilidade:** Isomórfico.
- **Usado por:** `quickcart`, `supermercado-noemia`, `entrelacos`
- **Atenção / não verificado:** Sem README.

### @adatechnology/customer-module
- **Versão:** `0.1.2` · `packages/backend/customer-module` · subpaths: `./schema`
- **Para quê:** Cadastro de clientes com banco, catálogo de campos declarado pelo produto, endereços e documento.
- **O que você ganha:**
  - CRUD de cliente (`CreateCustomerUseCase`, `UpdateCustomerUseCase`); busca por telefone e documento (`UpsertByPhoneUseCase`, `FindByDocumentUseCase`, `SetWhatsAppPhoneUseCase`)
  - Campos customizados validados contra o catálogo, com checagem de mudança destrutiva (`assertCatalogChangeIsSafe`)
  - Endereços (`AddAddressUseCase`) e configurações (`GetSettingsUseCase`)
  - Rotas por `createCustomerRoutes` e `module-http`
- **Entradas:** `createCustomerModule` em `src/CustomerModule.ts`; `createCustomerRoutes`; `runCustomerMigrations`; `./schema`
- **Precisa de:** PostgreSQL (Drizzle). Peers: `drizzle-orm`.
- **Compatibilidade:** Drizzle peer `>=0.36.0 <2`; schema `customer`; migrations com journal.
- **Usado por:** `quickcart`, `supermercado-noemia`, `entrelacos`
- **Atenção / não verificado:** Sem README.

### @adatechnology/customers-ui
- **Versão:** `0.1.0` · `packages/frontend/customers-ui`
- **Para quê:** Lista, ficha e configuração do catálogo de campos do cadastro de clientes, com API injetada.
- **O que você ganha:**
  - `CustomerList`, `CustomerDetail`, `CustomerSettingsPage`, `CustomersProvider`
  - `BrazilianDocumentInput`: um campo só para CPF ou CNPJ (inclusive alfanumérico); a máscara muda ao digitar o 12º caractere, `aria-invalid` quando o documento completo não fecha o dígito, `onValueChange` entrega o valor sem máscara
- **Entradas:** `src/index.ts`
- **Precisa de:** API compatível com `customer-module`; `@adatechnology/document-intake` (dependência). O campo de documento não precisa da API. Peers: `react`, `react-dom`.
- **Compatibilidade:** React 18+.
- **Usado por:** `quickcart`, `entrelacos`, `supermercado-noemia`
- **Atenção / não verificado:** Sem README.

### @adatechnology/catalog-contracts
- **Versão:** `0.1.0` · `packages/backend/catalog-contracts`
- **Para quê:** Contratos do trio de catálogo: produto, catálogo, seção, schemas, eventos e portas.
- **O que você ganha:**
  - Dinheiro em centavos inteiros; portas `MetaCatalogSyncPort`, `ProductImageStoragePort`, `ProductSuggestionPort`; erros com status estável
- **Entradas:** `src/index.ts`
- **Precisa de:** Nenhuma.
- **Compatibilidade:** Isomórfico.
- **Usado por:** `ada-technology`

### @adatechnology/catalog-module
- **Versão:** `0.3.0` · `packages/backend/catalog-module` · subpaths: `./http/fetch`, `./http/uws`, `./openapi`
- **Para quê:** Catálogo, cardápio e produtos com banco: CRUD, seções, estoque atômico, importação em lote e publicação opcional na Meta Commerce.
- **O que você ganha:**
  - CRUD de produtos, catálogos e seções; baixa de estoque atômica; importação em lote (`POST /products/bulk-import`)
  - Identificar produto por foto (`IdentifyProductByImageUseCase`, embeddings em `productEmbeddings`) junto de `product-vision-provider`
  - Publicação na Meta desligada por padrão (porta `MetaCatalogSyncPort`)
  - Rotas por `createCatalogRoutes`; adaptadores `./http/fetch`, `./http/uws` e OpenAPI em `./openapi`. **Escopos exigidos:** `catalog:read` (ou `catalog:write`) nas leituras e `catalog:write` nas mutações (`CATALOG_SCOPE`; vocabulário do host via `scopes`)
  - Listagem pronta para a tela: produto traz `catalogName`, catálogo traz `productCount`; `GET /catalogs/:id`. O `products-ui` lê direto com `createCatalogModuleProductsApi`
  - `GET /products` filtra e ordena no servidor: `catalogIds`/`sectionIds` (lista separada por vírgula; `none` = sem vínculo), `priceOnRequest`, `active`, `sortBy` (`name|price|catalog|section|active|sortOrder`) e `sortDirection`; produto traz `sectionName`. Sem esses parâmetros a ordem é a de exibição, como antes
- **Entradas:** `createCatalogModule` em `src/CatalogModule.ts`; `createCatalogRoutes`; `runCatalogMigrations`, `runCatalogVisionMigrations`
- **Precisa de:** PostgreSQL (Drizzle). A busca por foto exige a extensão `vector` no banco (migration de visão com journal próprio). Imagens por `catalog-image-storage-provider`. Peers: `drizzle-orm`.
- **Compatibilidade:** Drizzle peer `>=0.36.0 <1` (não aceita 1.x); schema `catalog`; migrations com journal, mais um conjunto separado para visão.
- **Usado por:** `ada-technology`

### @adatechnology/catalog-image-storage-provider
- **Versão:** `0.1.2` · `packages/backend/catalog-image-storage-provider`
- **Para quê:** Armazenamento de imagem de produto do `catalog-module` em bucket S3-compatível.
- **O que você ganha:**
  - `createS3ProductImageStorage` (implementa `ProductImageStoragePort`)
- **Entradas:** `src/index.ts`
- **Precisa de:** Bucket S3-compatível (via `object-storage-provider`).
- **Compatibilidade:** Bun/Node.
- **Usado por:** `ada-technology`
- **Atenção / não verificado:** Sem README.

### @adatechnology/product-vision-provider
- **Versão:** `0.2.0` · `packages/backend/product-vision-provider` · subpaths: `./barcode`, `./clip-local`, `./vlm-ollama`
- **Para quê:** Identifica produto por foto: leitor de código de barras (WASM) e embedding CLIP (ONNX), locais e encadeáveis.
- **O que você ganha:**
  - `createVisionChain` com os engines `./barcode`, `./clip-local` e `./vlm-ollama`
- **Entradas:** `src/index.ts`
- **Precisa de:** Peers opcionais `@undecaf/zbar-wasm` e `@huggingface/transformers`; Ollama só no engine `vlm-ollama`. Peers: `@huggingface/transformers`, `@undecaf/zbar-wasm`.
- **Compatibilidade:** Bun/Node.
- **Usado por:** `quickcart`, `supermercado-noemia`

### @adatechnology/meta-catalog-provider
- **Versão:** `0.2.1` · `packages/backend/meta-catalog-provider`
- **Para quê:** Cliente da Meta Commerce Catalog API: catálogos, produtos e conjuntos de produtos.
- **O que você ganha:**
  - `MetaCatalogProvider`: `createProduct`, `updateProduct`, `getProduct`, `deleteProduct`, conjuntos de produtos, `listCatalogs`, `createCatalog`, `linkCatalogToWaba`
- **Entradas:** `MetaCatalogProvider` em `src/MetaCatalogProvider.ts`
- **Precisa de:** Token e id de catálogo da Meta.
- **Compatibilidade:** Bun/Node.
- **Usado por:** `ada-technology`, `financing-chatbot`
- **Atenção / não verificado:** Sem README.

### @adatechnology/products-ui
- **Versão:** `0.3.0` · `packages/frontend/products-ui`
- **Para quê:** Gestão de produtos e catálogos com API injetada.
- **O que você ganha:**
  - `ProductsWorkspace`, `ProductList`, `ProductForm`, `CatalogList`, `BulkImport`, `ImageUpload` (com recorte de fundo)
  - **API pronta para o `catalog-module`:** `createCatalogModuleProductsApi({ baseUrl, getHeaders })` implementa `ProductsApi` sobre as rotas do módulo (envelope, paginação, importação CSV com `parseBulkImportCsv`, erro `CatalogModuleApiError`)
  - **Lista em tabela (opt-in):** `<ProductsWorkspace listing={{}} />` liga busca no servidor, filtros de seleção múltipla (catálogo, seção, disponibilidade, preço sob consulta), colunas ordenáveis, zebra, seleção com ações em lote (ativar/desativar, mover de catálogo, excluir com confirmação), paginação com itens por página, total de resultados e cartões no celular. O host injeta `renderSelect`/`renderMultiSelect` (o `Select` do design system dele), `renderExport` (menu de exportação) e guarda o estado na URL com `parseProductsListQuery`/`serializeProductsListQuery`
- **Entradas:** `src/index.ts`
- **Precisa de:** API compatível com `catalog-module`. Peers: `react`, `react-dom`.
- **Compatibilidade:** React 18+.
- **Usado por:** `ada-technology`, `comandada`

### @adatechnology/image-cutout
- **Versão:** `0.1.0` · `packages/frontend/image-cutout`
- **Para quê:** Recorte de fundo de imagem no navegador (U²-Net sobre onnxruntime-web), sem CDN.
- **O que você ganha:**
  - `removeBackground`, `useBackgroundRemoval`, preenchimento de cor de fundo
- **Entradas:** `src/index.ts`
- **Precisa de:** Nenhuma no servidor; o modelo roda no navegador. Peers: `react`, `react-dom`.
- **Compatibilidade:** React 18+.
- **Usado por:** `ada-technology`, `transportada`
- **Atenção / não verificado:** Sem README.

### @adatechnology/image-editor-ui
- **Versão:** `0.1.0` · `packages/frontend/image-editor-ui`
- **Para quê:** Editor de foto no navegador (canvas, sem dependências) que devolve o `Blob` editado e os metadados da edição, para o host guardar versões e manter a original.
- **O que você ganha:**
  - `ImageEditor`: recorte por formato (capa 16:9, galeria 3:2, quadrado, livre), girar, espelhar, zoom, brilho e contraste, ponto de foco, texto alternativo; teclado, toque e pinça; sem controle nativo
  - `focalPointToObjectPosition` para o `object-position` do site; rótulos `imageEditorLabelsPtBr`/`En`; tema por `--aie-*`
- **Entradas:** `src/index.ts`, `styles.css`
- **Precisa de:** Nenhuma no servidor; o host guarda as versões. Peers: `react`, `react-dom`.
- **Compatibilidade:** React 18+.
- **Usado por:** `reservada`

### @adatechnology/site-preview-ui
- **Versão:** `0.0.0` (primeira publicação pelo changeset) · `packages/frontend/site-preview-ui` · subpaths: `./guest`, `./styles.css`
- **Para quê:** Prévia ao vivo do site dentro do painel que o edita, sem reimplementar o iframe, o zoom nem o protocolo de rolagem.
- **O que você ganha:**
  - Painel (host): `SitePreview` (iframe em escala, seletor Computador/Tablet/Celular, zoom, "Ajustar", mão, Expandir lado a lado, tela cheia com foco preso, coluna fixa `spv-sticky`) ou, para desenhar a própria moldura, `useSitePreviewChannel` (envio do rascunho com debounce, foco, recarga de dados e rolagem guardada), `usePreviewPan`, `computePreviewScale`
  - Site (guest, sem React): `createPreviewGuest` registra as seções por `data-preview-field="chave"` (ou `registerSection`), destaca a seção em edição e rola até ela só se não estiver inteira na janela, devolve a rolagem depois de recarregar e entrega o rascunho (`onState`) e o pedido de recarga (`onRefresh`); fora de um iframe do mesmo domínio não faz nada
  - Protocolo versionado (`parseHostMessage`, `parseGuestMessage`): só mensagens do mesmo domínio e do canal; formato inválido é descartado
  - Tema por `--spv-*`; rótulos `sitePreviewLabelsPtBr`/`En`; tooltip da casa por `renderTooltip`
- **Entradas:** `src/index.ts` (host), `src/guest/index.ts` (site), `styles.css`
- **Precisa de:** Nenhuma no servidor. O site precisa servir uma rota de prévia (ex.: `/?preview=1`) no mesmo domínio do painel. Peers: `react`, `react-dom` (opcionais: o subpath `./guest` não usa React).
- **Compatibilidade:** React 18+; navegadores com `MutationObserver` e `sessionStorage` opcional.
- **Usado por:** `reservada` (hoje com a cópia local de mesma API em `apps/frontend-panel/src/ui/sitePreview` e `apps/frontend-site/src/preview/sdk`, até a publicação)

### @adatechnology/document-intake
- **Versão:** `0.1.0` · `packages/frontend/document-intake`
- **Para quê:** Leitura de documentos brasileiros no navegador (CRLV, CNH, CCMEI) por camada de texto do PDF e OCR.
- **O que você ganha:**
  - `readCrlv`, `extractCnhFields`, `readCcmei`; validadores (`isValidCpf`, `isValidCnpj`, `isValidPlate`, `isValidRenavam`)
  - **Documento brasileiro (puro, também serve no servidor):** `detectBrazilianDocumentKind` (CPF de 11 dígitos ou CNPJ de 14, inclusive o alfanumérico), `isValidBrazilianDocument` (dígitos verificadores; recusa repetidos), `formatBrazilianDocument` (`000.000.000-00` / `00.000.000/0000-00`), `maskBrazilianDocumentInput` (máscara progressiva para um campo só), `maskBrazilianDocumentForDisplay` (`•••.•••.•47-25`, últimos N visíveis), `normalizeBrazilianDocument` (tira só a máscara, nunca a letra)
  - `normalizePersonName`: apara e colapsa espaços, caixa de título, partículas `da de do das dos e` em minúscula (menos na primeira palavra), `D'Ávila`, `Ana-Maria`
  - `createTesseractOcrClient` como reserva
- **Entradas:** `src/index.ts`
- **Precisa de:** Nenhuma no servidor.
- **Compatibilidade:** Navegador; as funções de documento e de nome são puras e rodam em Bun/Node.
- **Usado por:** `transportada`
- **Atenção / não verificado:** Sem descrição no `package.json`.

### @adatechnology/recommendation-contracts
- **Versão:** `0.2.0` · `packages/backend/recommendation-contracts`
- **Para quê:** Contratos do trio de recomendações (patrocinadas e curadas).
- **O que você ganha:**
  - Tipos, schemas, erros e portas
- **Entradas:** `src/index.ts`
- **Precisa de:** Nenhuma.
- **Compatibilidade:** Isomórfico.
- **Usado por:** `entrelacos`
- **Atenção / não verificado:** Sem README.

### @adatechnology/recommendation-module
- **Versão:** `0.2.0` · `packages/backend/recommendation-module` · subpaths: `./schema`
- **Para quê:** Recomendações de qualquer tipo (lugar, evento, produto, serviço, conteúdo), patrocinadas ou da curadoria, com campanhas, posicionamentos e métricas.
- **O que você ganha:**
  - Itens com campos comuns e atributos do tipo declarados pelo produto
  - Campanhas, posicionamentos e estatística de impressão e clique
- **Entradas:** `createRecommendationModule` em `src/RecommendationModule.ts`; `runRecommendationMigrations`; `./schema`
- **Precisa de:** PostgreSQL (Drizzle). Peers: `drizzle-orm`.
- **Compatibilidade:** Drizzle peer `>=0.36.0 <2`; schema `recommendation`.
- **Usado por:** `entrelacos`

### @adatechnology/recommendations-ui
- **Versão:** `0.2.0` · `packages/frontend/recommendations-ui`
- **Para quê:** Feed de recomendações com rótulo de patrocinado e rastreio, e administração de itens, campanhas e métricas.
- **O que você ganha:**
  - `RecommendationFeed`, `RecommendationCard`, `RecommendationAdmin`, `createFetchRecommendationsApi`
- **Entradas:** `src/index.ts`
- **Precisa de:** API compatível com `recommendation-module`. Peers: `react`, `react-dom`.
- **Compatibilidade:** React 18+.
- **Usado por:** `entrelacos`
- **Atenção / não verificado:** Sem README.

## Agenda e reservas

### @adatechnology/scheduling-contracts
- **Versão:** `0.1.0` · `packages/backend/scheduling-contracts`
- **Para quê:** Contratos do trio de agendamento: recursos, serviços, reservas, disponibilidade, eventos e portas.
- **O que você ganha:**
  - Portas `VideoMeetingPort` e `CalendarSyncPort`
  - Sete eventos de ciclo de vida e hooks opcionais para regra comercial
- **Entradas:** `src/index.ts`
- **Precisa de:** Nenhuma.
- **Compatibilidade:** Isomórfico.
- **Usado por:** `ada-technology`, `comandada`

### @adatechnology/scheduling-module
- **Versão:** `0.1.1` · `packages/backend/scheduling-module` · subpaths: `./http/fetch`, `./http/uws`, `./openapi`
- **Para quê:** Agendamento de serviços e recursos com banco: disponibilidade, exceções, reservas com remarcação, confirmação e lembretes.
- **O que você ganha:**
  - CRUD de recursos e serviços, grades e exceções de disponibilidade, reserva, remarcação e cancelamento
  - Sobreposição de horários bloqueada por constraint `EXCLUDE` do PostgreSQL
  - Lembretes por cron (`createSchedulingSchedules`)
  - Vídeo e sincronização de calendário opcionais por porta (providers de calendário abaixo)
  - Rotas com paridade `fetch` e uWebSockets, e OpenAPI
- **Entradas:** `createSchedulingModule` em `src/SchedulingModule.ts`; `runSchedulingMigrations`; `./http/fetch`, `./http/uws`, `./openapi`
- **Precisa de:** PostgreSQL com extensão `btree_gist`; agendador do host para o cron. Peers: `drizzle-orm`.
- **Compatibilidade:** Drizzle peer `>=0.36.0 <1` (não aceita 1.x); schema `scheduling`; migrations com journal.
- **Usado por:** `ada-technology`, `comandada`

### @adatechnology/scheduling-ui
- **Versão:** `0.1.0` · `packages/frontend/scheduling-ui`
- **Para quê:** Agenda, reservas, recursos, serviços e disponibilidade, com API injetada.
- **O que você ganha:**
  - `SchedulingWorkspace` com cinco áreas, provider e hooks headless, textos em pt-BR
- **Entradas:** `src/index.ts`
- **Precisa de:** API compatível com `scheduling-module` (`SchedulingApi`). Peers: `@tanstack/react-query`, `react`, `react-dom`.
- **Compatibilidade:** React 18+, peer `@tanstack/react-query`.
- **Usado por:** `ada-technology`

### @adatechnology/web-booking-widget
- **Versão:** `0.1.0` · `packages/frontend/web-booking-widget`
- **Para quê:** Agendamento de serviço como Web Component (`<ada-booking-widget>`).
- **O que você ganha:**
  - Fluxo de reserva em passos para página externa; tema por atributo `theme`
- **Entradas:** `AdaBookingWidget`, `registerAdaBookingWidget` em `src/index.ts`
- **Precisa de:** API do produto hospedeiro (atributo `api-base`).
- **Compatibilidade:** Qualquer página; sem framework.
- **Usado por:** nenhum app do workspace declara a dependência

### @adatechnology/google-calendar-provider
- **Versão:** `0.1.0` · `packages/backend/google-calendar-provider`
- **Para quê:** `CalendarSyncPort` sobre a Google Calendar API v3.
- **O que você ganha:**
  - `createGoogleCalendarProvider`
- **Entradas:** `src/index.ts`
- **Precisa de:** Credenciais OAuth do Google.
- **Compatibilidade:** Bun/Node.
- **Usado por:** nenhum app do workspace declara a dependência
- **Atenção / não verificado:** Sem README.

### @adatechnology/microsoft-calendar-provider
- **Versão:** `0.1.0` · `packages/backend/microsoft-calendar-provider`
- **Para quê:** `CalendarSyncPort` sobre a Microsoft Graph API.
- **O que você ganha:**
  - `createMicrosoftCalendarProvider`
- **Entradas:** `src/index.ts`
- **Precisa de:** Credenciais Microsoft.
- **Compatibilidade:** Bun/Node.
- **Usado por:** nenhum app do workspace declara a dependência
- **Atenção / não verificado:** Sem README.

### @adatechnology/caldav-calendar-provider
- **Versão:** `0.1.0` · `packages/backend/caldav-calendar-provider`
- **Para quê:** `CalendarSyncPort` sobre CalDAV (iCloud e servidores genéricos).
- **O que você ganha:**
  - `createCaldavCalendarProvider`
- **Entradas:** `src/index.ts`
- **Precisa de:** Servidor CalDAV.
- **Compatibilidade:** Bun/Node.
- **Usado por:** nenhum app do workspace declara a dependência
- **Atenção / não verificado:** Sem README.

## Pagamentos, delivery e financeiro

### @adatechnology/payment-contracts
- **Versão:** `0.4.0` · `packages/backend/payment-contracts`
- **Para quê:** Contratos de pagamentos e assinaturas: tipos, máquina de estados da assinatura, porta do provedor e erros.
- **O que você ganha:**
  - Porta de provedor de pagamento, cobranças e eventos normalizados
- **Entradas:** `src/index.ts`
- **Precisa de:** Nenhuma.
- **Compatibilidade:** Isomórfico.
- **Usado por:** `comandada`
- **Atenção / não verificado:** Sem README.

### @adatechnology/payment-module
- **Versão:** `0.2.2` · `packages/backend/payment-module` · subpaths: `./schema`, `./testing`
- **Para quê:** Pagamentos e assinaturas com banco: webhook idempotente, plano da pessoa, checkout, cancelamento e rotas.
- **O que você ganha:**
  - `createPaymentModule` com planos e ofertas; `createPaymentRoutes`
  - Webhook idempotente e entitlements
  - Provedores plugáveis (README mostra Hotmart; `mercadopago-payment-provider` segue o mesmo contrato)
- **Entradas:** `createPaymentModule` em `src/PaymentModule.ts`; `runPaymentMigrations`; `./schema`, `./testing`
- **Precisa de:** PostgreSQL (Drizzle); provedor de pagamento injetado. Peers: `drizzle-orm`.
- **Compatibilidade:** Drizzle peer `>=0.36.0 <2`; schema `payment`.
- **Usado por:** nenhum app do workspace declara a dependência

### @adatechnology/mercadopago-payment-provider
- **Versão:** `0.2.0` · `packages/backend/mercadopago-payment-provider`
- **Para quê:** Plugin Mercado Pago: Pix, link de cartão, webhook assinado e estorno.
- **O que você ganha:**
  - `createMercadoPagoPaymentProvider`: `createCharge` (Pix com copia-e-cola, `payment_link`), `refundCharge`, webhook com `x-signature`
- **Entradas:** `src/index.ts`
- **Precisa de:** Access token da conta recebedora (uma instância por conta).
- **Compatibilidade:** Bun/Node.
- **Usado por:** `comandada`

### @adatechnology/hotmart-payment-provider
- **Versão:** `0.1.3` · `packages/backend/hotmart-payment-provider`
- **Para quê:** Plugin Hotmart: webhook 2.0.0 (hottok) normalizado e links de checkout.
- **O que você ganha:**
  - `createHotmartPaymentProvider`, `readHotmartOfferCode`
- **Entradas:** `src/index.ts`
- **Precisa de:** Hottok e URLs de checkout.
- **Compatibilidade:** Bun/Node.
- **Usado por:** nenhum app do workspace declara a dependência
- **Atenção / não verificado:** Sem README.

### @adatechnology/marketplace-contracts
- **Versão:** `0.1.0` · `packages/backend/marketplace-contracts`
- **Para quê:** Camada comum dos marketplaces de delivery (iFood, 99Food, Open Delivery): pedido, eventos, negociações, financeiro e avaliações.
- **O que você ganha:**
  - Porta `MarketplaceProvider`; mapeamento do status do PDV para a ação da plataforma (`actionForStatus`, `actionsToSend`)
  - Helpers HTTP: `TokenCache`, `withRetry`, `parseJsonKeepingBigInts`
- **Entradas:** `src/index.ts`
- **Precisa de:** Nenhuma (sem I/O).
- **Compatibilidade:** Isomórfico.
- **Usado por:** nenhum app do workspace declara a dependência

### @adatechnology/ifood-marketplace-provider
- **Versão:** `0.1.0` · `packages/backend/ifood-marketplace-provider`
- **Para quê:** Conector da Merchant API do iFood.
- **O que você ganha:**
  - Polling de eventos com acknowledgment, detalhe do pedido, ações, cancelamento, negociações, financeiro v3, avaliações v2, webhook HMAC
- **Entradas:** `IfoodMarketplaceProvider` em `src/index.ts`
- **Precisa de:** Credenciais do iFood.
- **Compatibilidade:** Bun/Node.
- **Usado por:** nenhum app do workspace declara a dependência

### @adatechnology/food99-marketplace-provider
- **Versão:** `0.1.0` · `packages/backend/food99-marketplace-provider`
- **Para quê:** Conector da 99Food no protocolo próprio.
- **O que você ganha:**
  - Webhook assinado, token por loja, ações, cancelamento, reembolso e financeiro
- **Entradas:** `Food99MarketplaceProvider` em `src/index.ts`
- **Precisa de:** Credenciais da 99Food.
- **Compatibilidade:** Bun/Node.
- **Usado por:** nenhum app do workspace declara a dependência

### @adatechnology/opendelivery-marketplace-provider
- **Versão:** `0.1.0` · `packages/backend/opendelivery-marketplace-provider`
- **Para quê:** Conector do padrão Open Delivery (Abrasel), serve a qualquer plataforma do padrão.
- **O que você ganha:**
  - OAuth, polling, ações, cancelamento e webhook HMAC
- **Entradas:** `OpenDeliveryMarketplaceProvider` em `src/index.ts`
- **Precisa de:** URL e credenciais da plataforma.
- **Compatibilidade:** Bun/Node.
- **Usado por:** nenhum app do workspace declara a dependência

### @adatechnology/expense-contracts
- **Versão:** `0.1.0` · `packages/backend/expense-contracts`
- **Para quê:** Regras puras de contas a pagar: vencimento, recorrência, parcelas, reajuste, previsão, lembretes e o fluxo de conversa para lançar conta.
- **O que você ganha:**
  - Dinheiro como texto de duas casas, contas em `bigint`, datas civis
  - `conversation`: máquina de estados para lançar conta por WhatsApp ou chat
  - `whatsappInput`: interpreta "R$ 1.500,50", "amanhã", "paguei 150"
- **Entradas:** `src/index.ts`
- **Precisa de:** Nenhuma (sem I/O).
- **Compatibilidade:** Isomórfico.
- **Usado por:** nenhum app do workspace declara a dependência

### @adatechnology/expense-module
- **Versão:** `0.1.0` · `packages/backend/expense-module` · subpaths: `./schema`, `./http/fetch`, `./openapi`
- **Para quê:** Contas a pagar com banco: categorias, contas fixas e variáveis, vencimentos gerados, baixa, histórico de valor e resumo.
- **O que você ganha:**
  - `createExpenseModule`: categorias, contas, vencimentos, pagar e reabrir, resumo do período
  - Rotas por `createExpenseRoutes` e OpenAPI
- **Entradas:** `createExpenseModule` em `src/ExpenseModule.ts`; `runExpenseMigrations`; `./schema`, `./http/fetch`, `./openapi`
- **Precisa de:** PostgreSQL (Drizzle). Peers: `drizzle-orm`.
- **Compatibilidade:** Drizzle peer `>=0.36.0 <1` (não aceita 1.x); schema `expense`; migrations com journal.
- **Usado por:** nenhum app do workspace declara a dependência

### @adatechnology/expense-mcp
- **Versão:** `0.1.0` · `packages/mcp/expense-mcp`
- **Para quê:** Servidor MCP de contas a pagar: o Claude consulta e lança contas pela API do produto.
- **O que você ganha:**
  - Ferramentas de consulta e lançamento, como `list_expense_categories` (lista completa no README)
- **Entradas:** Binário do pacote, registrado com `claude mcp add`
- **Precisa de:** API que exponha as rotas do `expense-module`; o MCP nunca fala com o banco.
- **Compatibilidade:** Bun/Node.
- **Usado por:** nenhum app do workspace declara a dependência

### @adatechnology/fiscal-provider
- **Versão:** `0.4.0` · `packages/backend/fiscal-provider`
- **Para quê:** Emissão de documentos fiscais brasileiros direto na SEFAZ ou prefeitura, sem intermediário.
- **O que você ganha:**
  - NFC-e (65), NF-e (55), NFS-e (ABRASF), CT-e (57) e SAT; o `index` traz também tipos de MDF-e
  - Assinatura A1, IBS/CBS (NT 2025.002), QR Code, DANFE e DANFCE em PDF, cancelamento
- **Entradas:** `createFiscalProvider` em `src/FiscalProviderFactory.ts`
- **Precisa de:** Certificado A1 do contribuinte (guardar cifrado, ver `secret-envelope`).
- **Compatibilidade:** Node e Bun.
- **Usado por:** `comandada`, `quickcart`, `transportada`, `supermercado-noemia`

## Infraestrutura, dados e observabilidade

### Cupons e promoções

### @adatechnology/coupon-contracts
- **Versão:** `0.0.0` (primeira publicação sai `0.1.0` pelo changeset) · `packages/backend/coupon-contracts`
- **Para quê:** Contratos do trio de cupons: campanha, código, lead, resgate, schemas, erros, portas e o avaliador puro do desconto.
- **O que você ganha:**
  - `evaluateCampaign` puro: período (início inclusivo, fim exclusivo), limites total/por código/por cliente, escopo (tudo, produtos, categorias, etiquetas), compra mínima, teto, percentual ou fixo; devolve todos os motivos de recusa de uma vez
  - Schemas zod compartilhados com o formulário (`createCampaignSchema`, `redeemCouponSchema`, `captureLeadSchema`…) e `checkCampaignRules`
  - Erros `CouponError` com `publicDetails` (campos e motivos) que chegam ao cliente em `error.details`
  - `canonicalPhone`/`canonicalEmail` (dedupe), `generateCouponCode` sem caracteres ambíguos, `campaignState`
  - `buildCsv` (neutraliza fórmula) e `buildXlsx` sem dependência — servem a qualquer exportação de planilha
- **Entradas:** `src/index.ts`
- **Precisa de:** Nenhuma.
- **Compatibilidade:** Isomórfico (Bun, Node, navegador).
- **Usado por:** nenhum ainda.

### @adatechnology/coupon-module
- **Versão:** `0.0.0` (primeira publicação sai `0.1.0`) · `packages/backend/coupon-module` · subpaths: `./http/fetch`, `./http/uws`, `./openapi`
- **Para quê:** Cupons e promoções com banco, para qualquer produto (reserva, pedido, assinatura): o pedido é uma referência opaca do host.
- **O que você ganha:**
  - CRUD de campanhas; código fixo (gerado se vazio), por lead (único por pessoa) ou lote com prefixo (até 10.000 por chamada); campanha automática e `findAutomatic` (maior desconto do carrinho)
  - `validateCoupon` (prévia), `redeemCoupon`/`releaseRedemption` idempotentes por `orderRef` com a campanha travada (limites não estouram em concorrência), código desativável
  - `captureLead`: campos e aceite (LGPD) por campanha, dedupe por telefone e e-mail canônicos (índice único), lote com `FOR UPDATE SKIP LOCKED`; portas `leadNotifier` (envio pelo `notification-module`) e `customerIdentity` (cliente do `customer-module`) depois do commit
  - Relatório (usos, liberações, desconto total, vendido, leads, códigos), listas paginadas de contatos, usos e códigos, exportação CSV/XLSX de todos os resultados do filtro com gancho de auditoria `onExported`
  - Rotas por `createCouponRoutes`: painel (`coupons:admin`), serviço para o backend do host (`coupons:service`) e públicas (banner, prévia, captação) que só sobem com `companyResolver` **e** `rateLimiter`
  - Nenhum dado pessoal nem código em log; `createInMemoryCouponPersistence` para teste do host
- **Entradas:** `createCouponModule` em `src/CouponModule.ts`; `createCouponRoutes`; `runCouponMigrations`; `couponOpenApiPaths` em `./openapi`
- **Precisa de:** PostgreSQL (Drizzle). Peers: `drizzle-orm`.
- **Compatibilidade:** Drizzle peer `>=0.36.0 <1`; schema `coupons`; journal `coupon_migrations` no formato clássico (`meta/_journal.json`).
- **Usado por:** nenhum ainda (Reservada tem a versão à mão a migrar).

### @adatechnology/coupons-ui
- **Versão:** `0.0.0` (primeira publicação sai `0.1.0`) · `packages/frontend/coupons-ui` · subpath: `./styles.css`
- **Para quê:** Telas de cupons com API injetada: painel e site.
- **O que você ganha:**
  - `CampaignsWorkspace` (tela composta): lista com busca (debounce, servidor), filtro de situação múltiplo, colunas ordenáveis, lote ativar/desativar, total, paginação, estado na URL e exportação da página ou de todos os resultados (CSV/XLSX); campanha com abas Configuração, Códigos, Contatos, Usos e Relatório (cada aba some sem o método da API)
  - Editor validado com os schemas do servidor; aviso "Confira: …" com atalho para cada campo; máscara de moeda e inteiros
  - Site: `CouponField` (desconto e todos os motivos), `LeadCaptureDialog` (só os campos pedidos, aceite, código com copiar), `CampaignBanner`
  - Headless: `useCampaignList`, `useCampaignEditor`, `useRecordList`, `useCouponPreview`, `useLeadCapture`
  - Rótulos por `messages` (pt-BR padrão, `en`), slots `renderSelect`/`renderDateTimeInput` para os componentes do design system do host, tema por variáveis `--acp-*`
- **Entradas:** `src/index.ts`
- **Precisa de:** API compatível com `coupon-module` (interfaces `CouponsAdminApi`, `CouponsPublicApi`). Peers: `react`, `react-dom`.
- **Compatibilidade:** React 18+.
- **Usado por:** nenhum ainda.

### @adatechnology/module-http
- **Versão:** `0.2.0` · `packages/backend/module-http` · subpaths: `./fetch`, `./uws`, `./openapi`, `./testing`
- **Para quê:** Camada HTTP compartilhada dos módulos: a rota é dado, e dela saem o adaptador `fetch`, o adaptador uWebSockets e o OpenAPI.
- **O que você ganha:**
  - `compileRoutes`, `dispatchRoute`, `findRoute`
  - `resolveClientIp({ headers, socketAddress, trustedHeader })`: IP do cliente atrás de proxy, só confia no cabeçalho que a borda põe (`x-real-ip` ou último salto de `x-forwarded-for`), recusa texto que não é endereço e agrupa IPv6 por /64
  - `./fetch` (`createModuleFetchRouter`), `./uws`, `./openapi`, `./testing`
  - Escopo checado no despachante: `requiredScopes` (basta um, senão 403); rota `admin`/`service` sem declarar exige ao menos um escopo na identidade
  - Resultado `binary` (arquivo para baixar com `Content-Type` próprio, ex.: XLSX) nos dois adaptadores
  - Erro de domínio com `publicDetails` (campos recusados, motivos): vai para `error.details` na resposta; `details` continua só no log
- **Entradas:** `src/index.ts`
- **Precisa de:** uWebSockets.js é peer opcional (só `./uws`).
- **Compatibilidade:** Bun/Node.
- **Usado por:** `ada-technology`, `quickcart`, `transportada`, `supermercado-noemia`, `entrelacos`

### @adatechnology/drizzle-provider
- **Versão:** `0.1.1` · `packages/backend/drizzle-provider`
- **Para quê:** Provider Drizzle tipado para Bun SQL e PostgreSQL.
- **O que você ganha:**
  - `createDrizzleProvider`
- **Entradas:** `src/index.ts`
- **Precisa de:** PostgreSQL.
- **Compatibilidade:** Bun.
- **Usado por:** `transportada`
- **Atenção / não verificado:** Sem README.

### @adatechnology/object-storage-provider
- **Versão:** `0.3.1` · `packages/backend/object-storage-provider`
- **Para quê:** Storage S3-compatível imutável para Bun, com URLs assinadas.
- **O que você ganha:**
  - `createObjectStorageProvider`: `put`, `get`, `head`, `delete`, `createSignedDownload`, `createSignedUpload`, `health`
- **Entradas:** `src/index.ts`
- **Precisa de:** Bucket S3-compatível.
- **Compatibilidade:** Bun.
- **Usado por:** `ada-technology`, `comandada`, `quickcart`, `transportada`, `supermercado-noemia`
- **Atenção / não verificado:** Sem README.

### @adatechnology/rabbitmq-provider
- **Versão:** `0.1.1` · `packages/backend/rabbitmq-provider`
- **Para quê:** Provider RabbitMQ tipado para workers e APIs.
- **O que você ganha:**
  - `createRabbitMqProvider`
- **Entradas:** `src/index.ts`
- **Precisa de:** RabbitMQ.
- **Compatibilidade:** Bun.
- **Usado por:** `transportada`
- **Atenção / não verificado:** Sem README.

### @adatechnology/cache
- **Versão:** `0.0.1` · `packages/backend/cache`
- **Para quê:** Cache em memória com TTL e `maxSize`.
- **O que você ganha:**
  - `new Cache<T>({ ttlMs, maxSize })`
- **Entradas:** `Cache` em `src/index.ts`
- **Precisa de:** Nenhuma (memória do processo). Para Redis compartilhado, `nestjs-cache`.
- **Compatibilidade:** Bun/Node.
- **Usado por:** nenhum app do workspace declara a dependência

### @adatechnology/infra-contracts
- **Versão:** `0.5.0` · `packages/backend/infra-contracts`
- **Para quê:** Contratos do módulo de infraestrutura Railway: tipos, erros e portas.
- **O que você ganha:**
  - `INFRA_ERROR_CODES` e `INFRA_AUDIT_ACTION` estáveis; portas de auditoria, senha e repositórios
- **Entradas:** `src/index.ts`
- **Precisa de:** Nenhuma.
- **Compatibilidade:** Isomórfico.
- **Usado por:** `ada-technology`

### @adatechnology/infra-module
- **Versão:** `0.5.1` · `packages/backend/infra-module` · subpaths: `./testing`
- **Para quê:** Gestão de infraestrutura Railway: inventário, ligar e desligar ambiente (bancos primeiro), agenda, custos e token cifrado.
- **O que você ganha:**
  - `PowerOffEnvironmentUseCase`, `PowerOnEnvironmentUseCase`, `SaveEnvironmentScheduleUseCase`, `GetInfraCostsUseCase`, `RunInfraSchedulesUseCase`
  - Integração do token do workspace, guardado cifrado
- **Entradas:** `src/InfraModule.ts`; `createRailwayGateway`; `./testing`
- **Precisa de:** PostgreSQL (Drizzle); portas de cache com compare-and-set, auditoria e verificação de senha; token Railway. Peers: `drizzle-orm`.
- **Compatibilidade:** Drizzle peer `>=0.36.0 <1` (não aceita 1.x); schema `infra`.
- **Usado por:** `ada-technology`

### @adatechnology/infra-ui
- **Versão:** `0.3.3` · `packages/frontend/infra-ui`
- **Para quê:** Tela de ambientes (ligar, desligar, agenda), custos e integração do token do provedor.
- **O que você ganha:**
  - `InfraWorkspace` (abas Ambientes, Custos e Integração) e hooks headless
- **Entradas:** `src/index.ts`
- **Precisa de:** API `InfraApi` implementada pelo host. Peers: `@tanstack/react-query`, `react`, `react-dom`.
- **Compatibilidade:** React 18+, peer `@tanstack/react-query`.
- **Usado por:** `ada-technology`

### @adatechnology/logger
- **Versão:** `0.1.0` · `packages/backend/logger`
- **Para quê:** Logger JSON estruturado com contexto por `AsyncLocalStorage`, `TraceStack`, middleware Bun/uWebSockets e redação de campos.
- **O que você ganha:**
  - `createLogger`, `runWithContext`, `createContext`, `traceMethod`
  - `redact` e `DEFAULT_REDACTED_KEYS`: redação central de campos sensíveis
  - `createUwsMiddleware`, `createHttpHandler`
- **Entradas:** `src/index.ts`
- **Precisa de:** Nenhuma.
- **Compatibilidade:** Bun/Node.
- **Usado por:** `transportada`

### @adatechnology/http-client
- **Versão:** `1.0.0` · `packages/backend/http-client`
- **Para quê:** Cliente HTTP (fetch) com retry, timeout e cabeçalhos de rastreio do `logger`.
- **O que você ganha:**
  - `HttpClient`, `createHttpClient`, `HttpError`
- **Entradas:** `src/index.ts`
- **Precisa de:** Peer `@adatechnology/logger`. Peers: `@adatechnology/logger`.
- **Compatibilidade:** Bun/Node.
- **Usado por:** nenhum app do workspace declara a dependência

### @adatechnology/logger-client
- **Versão:** `0.0.3` · `packages/frontend/logger-client`
- **Para quê:** Logger isomórfico de cliente (mobile, web, desktop) com rastreio de requisição.
- **O que você ganha:**
  - `initTraceContext`, `getGlobalTraceContext`, `TraceContext`
- **Entradas:** `src/index.ts`
- **Precisa de:** Backend que devolva `x-trace-id`.
- **Compatibilidade:** React Native, web, Node e Electron.
- **Usado por:** nenhum app do workspace declara a dependência
- **Atenção / não verificado:** Sem README no pacote; o README da raiz o descreve.

### @adatechnology/nestjs-logger
- **Versão:** `0.2.5` · `packages/backend/nestjs-logger`
- **Para quê:** Logger NestJS (Winston e OpenTelemetry) com contexto por requisição.
- **O que você ganha:**
  - `LoggerModule.forRoot`, `LOGGER_PROVIDER`, `HttpLoggingInterceptor`, `RequestContextMiddleware`, `runWithContext`
- **Entradas:** `src/index.ts`
- **Precisa de:** Nenhuma. Peers: `@nestjs/common`, `@nestjs/core`.
- **Compatibilidade:** NestJS.
- **Usado por:** nenhum app do workspace declara a dependência
- **Atenção / não verificado:** O README cita outro nome no import: use o nome do `package.json`.

### @adatechnology/nestjs-cache
- **Versão:** `0.0.26` · `packages/backend/nestjs-cache`
- **Para quê:** Cache NestJS com implementação em memória e Redis.
- **O que você ganha:**
  - `CacheModule` com providers `in-memory` e `redis`
- **Entradas:** `src/index.ts`
- **Precisa de:** Redis opcional (`ioredis`). Peers: `@nestjs/common`, `@nestjs/core`.
- **Compatibilidade:** NestJS.
- **Usado por:** nenhum app do workspace declara a dependência
- **Atenção / não verificado:** Sem README.

### @adatechnology/nestjs-http-client
- **Versão:** `0.0.32` · `packages/backend/nestjs-http-client`
- **Para quê:** Módulo HTTP NestJS (axios) com Promise e Observable, ids de requisição e cache.
- **O que você ganha:**
  - `HttpModule.forRoot` e `forRootAsync`, `UseHttpRequestId`
- **Entradas:** `src/index.ts`
- **Precisa de:** Nenhuma. Peers: `@nestjs/common`, `@nestjs/core`.
- **Compatibilidade:** NestJS, axios, rxjs.
- **Usado por:** nenhum app do workspace declara a dependência
- **Atenção / não verificado:** O README cita outro nome no import: use o nome do `package.json`.

### @adatechnology/media-processor
- **Versão:** `0.0.2` · `packages/backend/media-processor` · subpaths: `./types`, `./services`
- **Para quê:** Serviço de dublagem e legendas de vídeo, com fila e progresso por WebSocket.
- **O que você ganha:**
  - Pipeline de extrair áudio, transcrever, traduzir, gerar, alinhar e remuxar; saída em dublagem ou SRT/VTT
  - `MediaJobService`, `SubtitleService`, `WebSocketService`
- **Entradas:** `src/index.ts`
- **Precisa de:** Redis (BullMQ), PostgreSQL e ffmpeg.
- **Compatibilidade:** Node.
- **Usado por:** nenhum app do workspace declara a dependência

### @adatechnology/cargo-placement
- **Versão:** `0.1.0` · `packages/backend/cargo-placement` · subpaths: `./fixtures`
- **Para quê:** Empacotador de carga do baú (TransportAdA): posiciona caixas por parada numa grade de 5 cm.
- **O que você ganha:**
  - `resolveCargoLayout`, `resolveCargoPlacement`, `resolveCargoPlanLayers`; aritmética decimal em `bigint`; `deadline` opcional
- **Entradas:** `src/index.ts`; `./fixtures`
- **Precisa de:** Nenhuma (puro).
- **Compatibilidade:** Bun; pensado para worker thread.
- **Usado por:** `transportada`

## Internos e exemplos

### @adatechnology/shared
- **Versão:** `0.0.3` (privado, não publicado) · `packages/backend/shared`
- **Para quê:** Utilitários internos dos pacotes NestJS (tracing, erros, tipos). Privado, nunca publicado.
- **O que você ganha:**
  - Tracing OpenTelemetry, Datadog e CloudTrace
- **Entradas:** `src/index.ts`
- **Precisa de:** Nenhuma. Peers: `@opentelemetry/api`, `@nestjs/common`, `@nestjs/core`.
- **Compatibilidade:** NestJS.
- **Usado por:** nenhum app do workspace declara a dependência

### @adatechnology/nestjs-package
- **Versão:** `0.1.1` (privado, não publicado) · `packages/backend/nestjs-package`
- **Para quê:** Molde de pacote NestJS. Privado.
- **O que você ganha:**
  - Exemplo de módulo e service
- **Entradas:** `src/index.ts`
- **Precisa de:** Nenhuma. Peers: `@nestjs/common`, `@nestjs/core`.
- **Compatibilidade:** NestJS.
- **Usado por:** nenhum app do workspace declara a dependência

### frontend-example
- **Versão:** `0.0.0` (privado, não publicado) · `packages/frontend/example`
- **Para quê:** App Vite de exemplo (`packages/frontend/example`) que consome `conversations-ui` e `products-ui`. Privado.
- **O que você ganha:**
  - Referência de montagem das telas
- **Entradas:** `packages/frontend/example`
- **Precisa de:** Ver o exemplo.
- **Compatibilidade:** React, Vite.
- **Usado por:** nenhum app do workspace declara a dependência
