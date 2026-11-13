# Spec — Trio plugável `meta-whatsapp`

Extração da capacidade WhatsApp em módulo plugável reutilizável entre produtos.
Regra de referência: `~/.claude/rules/rules/packages/pluggable-module.md`.
Convenção de spec/tasks: espelha `~/Documents/personal/quickcart/.specs/features/mvp/`.

> **Status:** 🚧 Spec em revisão. Há decisões abertas em §10 marcadas
> `[NEEDS CLARIFICATION]`. **Nenhuma implementação começa enquanto existirem.**

---

## 1. Motivação e regra do 2º uso

A capacidade WhatsApp existe hoje **duplicada** em dois produtos, com implementações
divergentes:

| | `financiamento-imobiliario-bot` | `quickcart` |
|---|---|---|
| Webhook + HMAC | ✅ completo (+ nonce anti-replay) | ✅ |
| Engine de conversa | ❌ em TS — delega ao **n8n** + `flow_graphs` | ✅ em TS (handlers) |
| Envio (texto/mídia/template/interativo) | ✅ completo | ✅ parcial |
| Mídia durável (S3 + fila) | ✅ completo | parcial |
| STT (transcrição de áudio) | ❌ não existe | ✅ Groq |
| **UI de conversa** | ✅ **a mais completa do ecossistema** | ❌ não tem |
| Settings de WhatsApp (templates, welcome/farewell, variáveis) | ✅ completo | ❌ |

A regra do 2º uso está **satisfeita**: o bot é o 1º consumidor (e a fonte da extração),
o QuickCart é o 2º. O bot migra para o SDK depois de extraído — é o que prova que a
extração ficou correta.

**Fonte da extração é o `financiamento-imobiliario-bot`** (branch `staging`), exceto
onde a tabela acima aponta o QuickCart como mais completo (engine em TS, STT).

### Artefatos órfãos a descartar

`financiamento-imobiliario-bot/packages/meta-whatsapp-{contracts,module}/` contêm
apenas `dist/` + `node_modules/`, sem `src/`, **sem histórico no git** e não
referenciados por nenhum workspace. São de uma extração anterior abandonada.
A API pública deles serve como *referência de nomenclatura*; o código é descartado.

---

## 2. Escopo — o que é genérico e o que fica no produto

**Regra de corte:** vai para o SDK tudo que é WhatsApp/Meta. Fica no produto tudo que
é regra de negócio do domínio.

### 2.1 GENÉRICO → SDK

| Área | Origem (bot) |
|---|---|
| Webhook verify + HMAC + nonce anti-replay (Redis, TTL 300s) | `modules/webhook/**`, `ReceiveWhatsAppWebhook.use-case.ts:27-38,189-198` |
| Tipos do payload Meta (texto/imagem/áudio/vídeo/documento/sticker/interactive/order/echo/status) | `ReceiveWhatsAppWebhook.use-case.ts:40-110` |
| Persistência de sessões e mensagens | `schema/conversation-sessions.ts`, `schema/conversation-messages.ts` |
| Envio: texto, mídia, template, lista interativa | `modules/conversations/infra/WhatsAppSender.ts:46-105` + use-cases `Send*` |
| Janela de 24h e erro `WINDOW_EXPIRED` | `WhatsAppSender.ts` |
| Pipeline de mídia (proxy + fila + S3, idempotente por `sourceMediaId`) | `InboundMediaProcessor.ts`, `S3StorageProvider.ts` |
| Realtime SSE (hub, relay Redis, ticket de 60s) | `infra/sse/**`, `server.ts:92,150-160` |
| Settings de WhatsApp (template name/language/variables, welcome, farewell) | `modules/settings/**` |
| **Camada de design WhatsApp-fiel** | `apps/web/src/**` — ver §6 |
| **Áudio e documentos** | ver §7 e §8 |
| **Fluxograma**: modelo de nós, CRUD, posições, interpretador, editor visual | `modules/flows/**`, `components/flows/**`, `FlowsBlueprintPage.tsx` — ver Q1 §10 |

### 2.2 PRODUCT-SPECIFIC → fica no produto

Conteúdo de `flow-graphs.seed.json` (hab_pronto, consorcio, consignado…), MCMV
(`simulation-mcmv-rows`, `simulation-results`, `bank-rates`, `modules/simulations`),
`financing-clients`, `leads`, `fipe`, `open-finance`, `banks`, o ramo de simulação do
workflow n8n, e `topics` (consorcio/promocoes).

### 2.3 CAPACIDADE SEPARADA → trio próprio

**Catálogo** (`schema/catalogs.ts`, `schema/products.ts`, sync Meta Commerce) sai deste
trio e vira `meta-catalog-*`. Ver §2.5.

---

## 2.5 Camadas — conversa é agnóstica de canal

> Decisão do usuário: **conversa vai servir outras integrações além do WhatsApp**, e
> **catálogo é capacidade independente**. As pastas devem refletir isso desde já.

O erro a evitar é tratar "WhatsApp" como uma coisa só. São **três capacidades** com
ciclos de vida diferentes:

```
┌──────────────────────────────────────────────────────────┐
│  CONVERSA  (agnóstica de canal)                          │
│  sessões · mensagens · takeover · inbox · realtime       │
│  fluxograma · design da bolha · áudio · documentos       │
│  → serve WhatsApp hoje; Telegram/webchat/Instagram amanhã│
└──────────────────────────────────────────────────────────┘
             ▲ implementa ChannelAdapter
┌────────────┴─────────────────────────────────────────────┐
│  CANAL META/WHATSAPP  (transporte, específico)           │
│  webhook · verify · HMAC · nonce · tipos do payload Meta │
│  envio via Graph API · janela de 24h · templates         │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│  CATÁLOGO  (independente — não depende de conversa)      │
│  catálogos · produtos · sync Meta Commerce               │
│  → aparece no WhatsApp, na web, ou em qualquer canal     │
└──────────────────────────────────────────────────────────┘
```

**A costura entre conversa e canal é um `ChannelAdapterInterface`** declarado no
contracts de conversa. O `meta-whatsapp-module` implementa esse adapter. Um futuro
`telegram-module` implementa o mesmo, sem que a camada de conversa mude.

Evidência de que essa sempre foi a intenção: o pacote de frontend já existente se
chama **`conversations-ui`**, não `whatsapp-ui`.

### Como isso vira pastas

Aplicando a **regra do 2º uso** de forma honesta: hoje existe **um só canal** em
produção (WhatsApp), então extrair `conversations-*` como pacote publicado agora seria
abstração prematura pela própria regra. Mas existe **certeza declarada** de que virão
outros canais.

Solução: **fronteira de pasta rígida agora, pacote separado quando o 2º canal chegar.**
A extração posterior vira mecânica (mover pasta + `package.json`), não refatoração.

```
packages/backend/meta-whatsapp-module/src/
├── conversations/     ← AGNÓSTICO. Não pode importar de channel/
│   ├── schema/            sessions, messages
│   ├── repositories/
│   ├── use-cases/         takeover, log, export, list
│   ├── realtime/          SSE hub + relay
│   └── flows/             modelo de nós, CRUD, interpretador
├── channel/           ← ESPECÍFICO Meta. Pode importar de conversations/
│   ├── webhook/           verify, HMAC, nonce, parsing
│   ├── sender/            wrapper do whatsapp-provider
│   ├── media/             download/upload Meta
│   └── settings/          templates, welcome, farewell
└── index.ts               factory que costura os dois
```

**Regra de lint a aplicar (obrigatória):** `conversations/` **não pode** importar de
`channel/`. A dependência é unidirecional. Isso é o que mantém a extração futura
barata — e é verificável automaticamente (`eslint-plugin-boundaries` ou
`dependency-cruiser`).

Mesma disciplina no frontend:

```
packages/frontend/conversations-ui/src/
├── conversations/   → export "."         inbox, bolha, áudio, documentos
├── flows/           → export "./flows"   editor React Flow (peer opcional)
└── channel/         → export "./whatsapp" settings específicos de WhatsApp
```

### Catálogo — trio separado desde já

Diferente da conversa, o catálogo **já** é independente na prática. Inventário
confirmou a separação mais limpa do ecossistema: zero FK para tabelas de conversa,
zero import de código de conversa, e dependência unidirecional conversa → catálogo.

Vai como trio próprio `meta-catalog-{contracts,module,ui}` — spec completa em
[`.specs/features/meta-catalog-trio/spec.md`](../meta-catalog-trio/spec.md).

> ⏸️ **Catálogo está ADIADO por decisão do usuário.** A ordem é: extrair o WhatsApp →
> implementar num produto → só então atacar o catálogo. Neste esforço, o único
> artefato de catálogo produzido é a **interface `CatalogPort`** (declaração, sem
> implementação) e o **move mecânico** do `MetaCatalogProvider` para fora do pacote de
> WhatsApp — que acontece junto porque evita uma segunda major (ver Fase 1 do
> `tasks.md`). Nenhum módulo, schema ou UI de catálogo é construído agora.

**Costura:** este módulo declara um **`CatalogPort` opcional**. Sem catálogo injetado,
os recursos de produto (`SendProductList`, `HandleProductInquiry`, `HandleCatalogOrder`)
ficam desligados e o WhatsApp funciona normal. Com catálogo, o `meta-catalog-module`
fornece o adapter. Nenhum dos dois pacotes importa o outro — quem costura é o produto.

---

## 3. Anatomia do trio

```
adatechnology-packages/packages/
├── backend/
│   ├── whatsapp-provider/          @adatechnology/whatsapp-provider  (JÁ EXISTE, v0.2.3)
│   │                               SDK Meta de baixo nível — o module usa por baixo
│   ├── meta-whatsapp-contracts/    @adatechnology/meta-whatsapp-contracts  (CRIAR)
│   └── meta-whatsapp-module/       @adatechnology/meta-whatsapp-module     (CRIAR)
└── frontend/
    └── conversations-ui/           @adatechnology/conversations-ui  (EVOLUIR — é o 3º do trio)
        ├── src/            → export "."        conversa, design, áudio, documentos
        └── src/flows/      → export "./flows"  editor de fluxograma (React Flow opcional)
```

**Decisão:** o 3º pacote do trio **é o `conversations-ui` existente**, evoluído — não se
cria um `meta-whatsapp-ui`. Ele já tem o esqueleto headless correto
(`ConversationsApi` injetável, `providers/types.ts:3-14`) e 22 componentes. Renomear
custaria uma major sem ganho.

**Relação com o `whatsapp-provider`:** o `module` **envolve** o provider, não o
substitui. O provider continua sendo o cliente HTTP da Graph API; o module adiciona
persistência, webhook, portas de extensão e ciclo de vida.

---

## 4. `meta-whatsapp-contracts`

Zero dependências além de `zod`. Fonte única de tipos para backend e frontend.

| Módulo | Conteúdo |
|---|---|
| `webhook.types` | `MetaWhatsAppMessage`, `MessageEcho`, `Status`, `Media`, `Interactive`, `Order`, `Context`, `WebhookPayload/Entry/Change`, `WebhookInput` (com `rawBody`, `signature`, `nonce`) |
| `webhook.schema` | zod: `MetaWhatsAppMessageSchema`, `MetaWhatsAppWebhookPayloadSchema` |
| `conversation.types` | `ConversationMessage`, `NewConversationMessage`, `ConversationSession`, `ConversationListItem/ListPage`, `SessionMode`, `LogMessageInput` |
| `settings.types` | **novo** — `WhatsAppSettings`, `TemplateConfig`, `TemplateVariablesMap`, `CreateTemplateInput` |
| `events` | `META_WHATSAPP_EVENTS` (`message.received`, `message.echo`, `message.status.updated`, `session.mode.changed`) + `MetaWhatsAppHooks`; `onMessageReceived` devolve `{outcome:'handled'\|'continue'}` |
| `providers` | portas: `MetaWhatsAppCacheInterface`, `MetaWhatsAppLoggerInterface`, `RealtimeNotifierInterface`, `InboundMediaQueueInterface`, `ObjectStorageInterface`, **`SubjectResolverInterface`** (novo — §5.3) |
| `errors` | `META_WHATSAPP_ERROR_CODES` (incl. `WINDOW_EXPIRED`, `INVALID_SIGNATURE`, `TEMPLATE_NOT_CONFIGURED`) + `MetaWhatsAppErrorContext` |

O estado da conversa é **string opaca** para o SDK. O enum de 38 estados de
financiamento (`enums.ts:126-170`) **não** entra — é do produto.

---

## 5. `meta-whatsapp-module`

Bun + Drizzle + PostgreSQL. Sem leitura de `process.env`, sem criar conexão própria.

### 5.1 Factory

```ts
const whatsapp = createMetaWhatsAppModule({
  db,                    // Drizzle do host
  config: { phoneNumberId, accessToken, webhookVerifyToken, appSecret, apiVersion, baseUrl },
  providers: { cache, logger, realtime, mediaQueue, storage, subjectResolver },
  hooks: { onMessageReceived, onMessageEcho, onStatusUpdated, onSessionModeChanged },
})

whatsapp.registerRoutes({ server, basePath: '/whatsapp' })
await runMetaWhatsAppMigrations(db)
```

### 5.2 Isolamento no banco

`pgSchema('meta_whatsapp')`, journal próprio `meta_whatsapp_migrations`, migrations
append-only. Tabelas: `sessions`, `messages`, `settings`, `media`.
Um banco por produto — o módulo apenas ocupa um namespace nele.

### 5.3 Portas de extensão (as únicas permitidas)

| Porta | Por que existe |
|---|---|
| `onMessageReceived` | **Substitui o forward hardcoded para n8n.** O bot pluga o forward n8n aqui; o QuickCart pluga sua engine em TS. Retorno `handled` interrompe, `continue` segue o pipeline padrão |
| `SubjectResolverInterface` | Resolve "de quem é essa conversa" — hoje o `InboundMediaProcessor` busca `financing_clients` por número, o que é do produto |
| `RealtimeNotifierInterface` | O host decide SSE, WebSocket ou nada |
| `ObjectStorageInterface` | Delega ao `@adatechnology/object-storage-provider` já existente — o módulo **não** reimplementa S3 |
| `MetaWhatsAppCacheInterface` | Nonce anti-replay e cache de mensagens |

### 5.4 Correções aproveitando a extração

- **Outbound em base64 no banco:** hoje `conversation_messages.payload` guarda o
  arquivo inteiro em base64 (`MessageBubble.tsx:114-131` renderiza do data-URI). No
  módulo, outbound vai para o object storage e a mensagem referencia `uploadId`.
- **Rotas hardwired:** catalog-order e product-inquiry saem do transporte e viram
  hooks.

---

## 6. Camada de design (peso máximo)

> O usuário sinalizou explicitamente: **design é o que mais pesa**. Fidelidade visual
> ao WhatsApp é critério de aceite, não detalhe.

Hoje **nada** está extraído — tudo vive em `apps/web` do bot, e os tokens estão
**duplicados** em dois lugares que precisam ser reconciliados em um só:

| Artefato | Origem | Observação |
|---|---|---|
| Paleta `whatsapp.*` | `apps/web/tailwind.config.js:27-40` | bubble-agent `#d9fdd3`/dark `#005c4b`, bubble-bot `#d7f0ec`/`#0a3d3a`, bubble-customer `#ffffff`/`#202c33`, wallpaper `#efeae2`/`#0b141a`, header `#075e54`; `maxWidth.bubble 75%` / tablet `65%` |
| Tokens TS | `apps/web/src/shared/theme/theme.constant.ts` | `COLORS`, `TYPOGRAPHY` (9–30px, `leading.tight 19px`), `RADIUS`, `SHADOW`, `DIMENSION` (media 220px, audioPlayer 200–260px, statusTick 15px, emojiPicker 280px) |
| **`.wa-wallpaper`** | `apps/web/src/index.css:119-129` | Padrão doodle em data-URI SVG (círculos, folhas, cruzes), 100×100 repeat, claro `#d7cfc0` / escuro `#19232a`. **O artefato mais crítico de copiar** — não existe asset binário |
| `MessageBubble` | `components/MessageBubble.tsx:309-422` | Cor por *sender* (agent/bot/customer), tail via `rounded-tr-md`/`rounded-tl-md` só no `isFirstInGroup`, agrupamento `mt-2`/`mt-0.5`, `ring-1 ring-red-400` em falha, chip de nome, badge de template |
| `Ticks` | `MessageBubble.tsx:57-69` | SVG inline 20×12 renderizado a 15×9; `read → text-sky-500`, `failed → text-red-500`, senão 40% preto/branco; Tooltip Radix com `readAt` ou "janela expirada" |
| Formatação WhatsApp | `lib/whatsapp-formatting.tsx:50` | `*negrito*`, `_itálico_`, `` `code` `` + `waToHTML`/`htmlToWA` para o editor contenteditable |
| Demais | `Avatar`, `DateDivider`, `SimpleEmojiPicker`, `WhatsAppMessageEditor`, `ImageLightbox` (`MessageBubble.tsx:89-103`) | |

Ícones: `lucide-react`. **Não existe** renderização de reply/quote, link preview nem
localização — as branches `feature/whatsapp-link-preview` e
`feature/whatsapp-native-location` são remote-only, não mergeadas em `staging`.
`components/flows/FlowWhatsAppPreview.tsx` duplica estilo de bolha e deve passar a
consumir o pacote.

**Bloqueio conhecido:** todo componente importa o barrel pt-BR do produto
(`SENDER_LABEL` ← `locales`). Antes de empacotar, isso vira props/context com strings
default pt-BR e override pelo host.

---

## 7. Áudio

**Estado atual (bot):** entrada detecta `audio` → BullMQ → `InboundMediaProcessor` →
S3 → `uploads`; ou proxy sob demanda `/conversations/media/:mediaId`.
`AudioPlayer.tsx` (122 linhas): `<audio preload="metadata">`, play/pause, **waveform
falsa** (30 barras de array hardcoded `:22-26`, não calculada do buffer),
click-to-seek, tempo `m:ss`, cor por `isMine`.

**Não existe:** controle de velocidade, arrasto de scrub, waveform real, transcrição
(STT) e **gravador de voz outbound** (`MediaRecorder`/`getUserMedia`: zero ocorrências).

**Decisão:** extrair o `AudioPlayer` como está (paridade primeiro), e tratar waveform
real, velocidade, gravador e STT como *enhancements* pós-paridade. O STT sai do
QuickCart (Groq), não do bot.

---

## 8. Documentos

Outbound: `POST /conversations/:whatsapp/send-media` → `SendAgentMedia` →
`WhatsAppSender.sendMedia`. Inbound: worker → S3 → URL assinada via
`GET /uploads/:id/download-url`. Lista por conversa
`GET /api/uploads/conversation/:whatsapp`; lista global `DocumentsPage.tsx` com
filtros, paginação e zip em lote (`POST /uploads/zip`). Imagens abrem em
`ImageLightbox` (portal Radix, `max-h-[90vh]`).

Aceite `image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.zip`
(`ConversationsPage.tsx:1487-1494`).

**Lacunas a corrigir na extração:** ícone único `FileText` para todo tipo não-mídia
(faltam ícones por extensão) e ausência de formatação de tamanho na bolha (só existe
em `DocumentsPage`).

---

## 9. Ordem de migração

```
Fase 1-2  contracts + module (backend)
Fase 3    conversations-ui: design, áudio, documentos  ← maior esforço
Fase 4    conversations-ui: telas de Settings
Fase 5    bot consome o SDK        (1º consumidor — prova a extração)
Fase 6    quickcart consome o SDK  (2º consumidor — prova a generalidade)
```

O bot migra **antes** do QuickCart de propósito: ele é a fonte, então qualquer
regressão visual ou funcional aparece imediatamente contra um baseline conhecido.

---

## 10. Decisões abertas — `[NEEDS CLARIFICATION]`

**Q1. ✅ RESOLVIDA — o fluxograma entra no próprio trio `meta-whatsapp`.**

Decisão do usuário: um trio só, sem `flow-engine-*` separado. Inventário do que entra:

| Camada | Origem | Tamanho |
|---|---|---|
| Editor visual (`@xyflow/react` v12) | `apps/web/src/components/flows/` — `FlowMapCanvas`, `FlowMapNode`, `FlowNodeCard`, `FlowNodePanel`, `FlowPalette`, `FlowPortalNode`, `FlowGroupFrame`, `FlowGroupHeader`, `flowGraph.ts` | 1.340 linhas |
| Página do blueprint | `apps/web/src/pages/FlowsBlueprintPage.tsx` | 893 linhas |
| Preview WhatsApp no editor | `components/flows/FlowWhatsAppPreview.tsx` | 74 linhas |
| Modelo de nós | `apps/api/src/modules/flows/domain/FlowGraph.ts:13-56` | `question`, `entrada_choice`, `action`, `menu`, `condition` |
| CRUD + posições | `apps/api/src/modules/flows/**` (Create/Update/Delete/List, `GetLiveFlowPositions`) | |
| Persistência | `schema/flow-graphs.ts` (`key`, `label`, `start_node_id`, `nodes`, `version`) | |

O modelo de nós é domain-neutral **exceto** `actionKind: 'trigger_simulation'` e
`simulationTemplate` (`FlowGraph.ts:16,24`), que são de financiamento e viram *actions
registráveis pelo host* (`registerFlowAction(kind, handler)`).

**Onde cada parte fica:**

- `meta-whatsapp-contracts` → `flow.types` (modelo de nós, `FlowGraph`, `FlowNode`,
  `FlowActionKind` extensível) + zod
- `meta-whatsapp-module` → tabela `meta_whatsapp.flow_graphs`, CRUD, posições
  (`GetLiveFlowPositions`), e o interpretador de grafo — plugado por padrão no
  `onMessageReceived`, podendo ser desligado por config (`features.flowEngine`)
- `conversations-ui` → o editor visual, em **subpath export próprio**

**Custo assumido e mitigação (obrigatória).** Empacotar junto faz o React Flow
(`@xyflow/react` v12) entrar no trio, e todo consumidor que só quer trocar mensagem
pagaria esse bundle. Mitigação inegociável no `package.json` do `conversations-ui`:

```jsonc
"exports": {
  ".":       { "import": "./dist/index.js",       "types": "./dist/index.d.ts" },
  "./flows": { "import": "./dist/flows/index.js", "types": "./dist/flows/index.d.ts" }
}
```

com `@xyflow/react` como **peer dependency opcional**
(`peerDependenciesMeta: { "@xyflow/react": { "optional": true } }`). Quem importa só
`@adatechnology/conversations-ui` não carrega o editor; quem quer o fluxograma importa
`@adatechnology/conversations-ui/flows` e instala o React Flow. No backend, o
interpretador é ligado/desligado por flag de config.

Sem essa separação por subpath, o QuickCart (que não usa fluxograma) carregaria React
Flow à toa — o que reintroduziria exatamente o problema que a regra de granularidade
tenta evitar.

**Q2. Qual é a branch de migração do bot para o SDK?**
Não encontrada em nenhum dos 3 repos (bot: `staging`, `main`,
`feature-flow-design-development`, `fix/hab-pronto-entrada-staging` + 13 remotas;
`adatechnology-packages`: `main`, `codex/t007-lock`, `feat/fiscal-reforma-tributaria-nfce-nfe`;
`quickcart`: `main`). Se existir conteúdo prévio, ele deve ser lido antes de planejar
as Fases 5-6.

**Q3. As tabelas `uploads`/`upload_*_links` entram no schema do módulo?**
Elas hoje servem tanto WhatsApp quanto upload manual de admin
(`source: whatsapp_inbound | whatsapp_outbound | manual_admin`).
→ *Recomendação:* o módulo tem sua própria `meta_whatsapp.media` (só o que vem/vai da
Meta) e expõe `ObjectStorageInterface`; a tabela `uploads` genérica do produto
permanece no produto, ligada por `mediaId`.

**Q4. Settings ficam em tabela própria do módulo ou no `app_config` do host?**
Hoje tudo mora num único `app_config` misturando chaves de tenant (`company_*`),
de WhatsApp (`whatsapp_*`) e de produto (`simulations-enabled`, `topics`).
→ *Recomendação:* `meta_whatsapp.settings` própria, só com chaves de WhatsApp.

---

## 11. Critérios de aceite

- [ ] Trio publicado no registry `@adatechnology` com semver e changeset
- [ ] `meta_whatsapp` pgSchema + journal `meta_whatsapp_migrations` próprios
- [ ] Zero `process.env` dentro dos pacotes — config 100% injetada e validada por zod
- [ ] Zero regra de negócio de financiamento ou de supermercado nos pacotes
- [ ] Zero import do barrel de `locales` de produto nos componentes
- [ ] Camada headless exportada independente das telas
- [ ] `conversations-ui` com subpath `./flows` e `@xyflow/react` como peer opcional —
      QuickCart (sem fluxograma) **não** carrega React Flow no bundle
- [ ] **Regra de fronteira automatizada em CI:** `conversations/` não importa de
      `channel/`. Build quebra se violado
- [ ] Catálogo **fora** deste trio, em `meta-catalog-*` próprio
- [ ] `ChannelAdapterInterface` declarado — provável que um 2º canal seja implementável
      sem tocar na camada de conversa (validar por revisão de desenho)
- [ ] **Paridade visual pixel-a-pixel** com o bot atual (wallpaper, bolhas, ticks,
      agrupamento, dark mode) — validada por screenshot antes/depois
- [ ] Bot rodando sobre o SDK sem regressão funcional nem visual
- [ ] QuickCart rodando sobre o SDK
- [ ] README de cada pacote: instalação, factory, portas, exemplo de host
- [ ] Revisão final com `opus` antes de publicar (gate obrigatório)

---

## 12. Riscos

| Risco | Mitigação |
|---|---|
| Regressão visual na extração do design | Screenshots antes/depois por componente; bot migra primeiro (baseline conhecido) |
| Acoplamento de locale espalhado por todos os componentes | Fase dedicada, mecânica, antes de mover qualquer componente |
| `conversationStateEnum` é um enum Postgres de financiamento | SDK trata estado como string opaca; label/cor injetados pelo host |
| Base64 no banco vira dívida ao empacotar | Corrigir na extração (storage + `uploadId`) |
| Divergência bot × quickcart durante a migração | Migrar o bot inteiro antes de começar o QuickCart |
| Token da Meta exposto em `packages/backend/meta-business/catalog/readme.md:13` | **Revogar e rotacionar** — ver §13 |

---

## 13. ⚠️ Segurança — ação imediata

`adatechnology-packages/packages/backend/meta-business/catalog/readme.md:13` contém
o que aparenta ser um **access token real da Meta** (`EAAduby...`) em texto plano, em
arquivo versionado. Revogar no painel da Meta, rotacionar e remover do histórico do
git. Independe desta spec.
