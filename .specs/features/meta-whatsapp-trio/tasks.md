# Tasks — Trio plugável `meta-whatsapp`

Plano de execução da [`spec.md`](./spec.md). Catálogo **adiado** — ver §2.5 da spec.

**Protocolo de modelo** (`~/.claude/rules/rules/model-economy.md`): ao iniciar uma fase,
comparar o modelo da sessão com o recomendado. Se divergir, **parar e pedir a troca**
antes de tocar em código. Tasks marcadas 🧠 exigem upgrade pontual.

**Guard-rails em toda task:** `tsc --noEmit` · testes do pacote · commit isolado.

---

## Ordem geral

```
F0 fundação → F1 providers → F2 contracts → F3 conversa → F4 fluxograma
   → F5 canal → F6 UI design → F7 UI settings+flows → F8 consumidor → F9 publicação
```

F3 e F4 podem correr em paralelo com F5 (times diferentes) — dependem só de F2.

---

## Fase 0 — Fundação e fronteiras
> 🤖 Modelo: `opus` (T0.1 e T0.4 são estruturais) · demais `haiku`

| # | Task | Critério de aceite |
|---|---|---|
| T0.1 🧠 | ADR da extração: camadas conversa/canal, `ChannelAdapterInterface`, `CatalogPort` opcional, decisão de fluxograma dentro do trio | ADR em `docs/adr/` revisado |
| T0.2 | Scaffolding dos pacotes: `meta-graph-core`, `meta-whatsapp-provider`, `meta-catalog-provider`, `meta-whatsapp-contracts`, `meta-whatsapp-module` — `package.json`, `tsconfig`, `tsup`, changeset | `turbo build` passa vazio |
| T0.3 | `conversations-ui`: configurar `exports` com subpaths `.`, `./flows`, `./whatsapp`; `@xyflow/react` como peer **opcional** | `bun run build` gera os 3 entry points |
| T0.4 🧠 | Regra de fronteira em CI: `conversations/` **não importa** `channel/` (`dependency-cruiser` ou `eslint-plugin-boundaries`) | Violação proposital quebra o build |

**Verificação:** `turbo build && turbo lint`

---

## Fase 1 — Reorganização dos providers Meta
> 🤖 Modelo: `haiku` (mecânico: mover arquivos e renomear)
> Depende de: F0

Feita **agora**, mesmo com catálogo adiado, para não gastar duas majors no
`whatsapp-provider`. Rename do pacote incluído nesta rodada (decisão do usuário).

> ⚠️ **Ordem obrigatória: T1.1 antes de T1.3.** O `MetaCatalogProvider` importa
> `graphFetch`, `assertConfigField` e `graphResponseSchemas` de `shared/`, compartilhados
> com messages e templates. Mover o catálogo sem extrair o `meta-graph-core` antes
> obrigaria a duplicar o encanamento.

| # | Task | Critério de aceite |
|---|---|---|
| T1.1 | Criar `meta-graph-core`: mover `shared/graphFetch.ts`, `assertConfigField.ts`, `graphResponseSchemas.ts`, `errors/WhatsAppError.ts` → `MetaGraphError` | Pacote publicável, sem referência a WhatsApp |
| T1.2 | Renomear `whatsapp-provider` → `meta-whatsapp-provider`; manter `messages` + `templates`; consumir `meta-graph-core` | `bun run check` limpo |
| T1.3 | Mover `WhatsAppCatalogProvider` → `meta-catalog-provider` como `MetaCatalogProvider` | Zero símbolo `WhatsApp*` no pacote de catálogo |
| T1.4 | Atualizar consumidores: bot (api, worker) e quickcart (api, worker) | Ambos os produtos compilam e sobem |

**Verificação:** `turbo build && turbo test` · subir bot e quickcart localmente
**Nota:** major nos 3 pacotes; changeset com nota de migração de imports.

---

## Fase 2 — `meta-whatsapp-contracts`
> 🤖 Modelo: `haiku` (mover tipos existentes) · T2.5 é `sonnet`
> Depende de: F0

| # | Task | Critério de aceite |
|---|---|---|
| T2.1 | `webhook.types` + `webhook.schema` (zod) — extrair de `ReceiveWhatsAppWebhook.use-case.ts:40-110` | Cobre texto, imagem, áudio, vídeo, documento, sticker, interactive (button_reply/list_reply), order, context.referred_product, echo, status |
| T2.2 | `conversation.types` — session, message, listagem, `SessionMode` | Estado é `string` opaca (**não** importar o enum de financiamento) |
| T2.3 | `flow.types` — `FlowGraph`, `FlowNode`, `FlowActionKind` extensível | `trigger_simulation` **não** aparece; actions são registráveis |
| T2.4 | `settings.types` — `WhatsAppSettings`, `TemplateConfig`, `TemplateVariablesMap` | — |
| T2.5 | `events` (`MetaWhatsAppHooks`), `providers` (portas, incl. `ChannelAdapterInterface`, `SubjectResolverInterface`, `CatalogPort`), `errors` | `onMessageReceived` devolve `{outcome:'handled'\|'continue'}` |

**Verificação:** `tsc --noEmit` · zero dependência além de `zod`

---

## Fase 3 — `module/conversations/` (agnóstico de canal) ✅ CONCLUÍDA
> 🤖 Modelo: `sonnet`
> Depende de: F2
> Pacote: `@adatechnology/meta-whatsapp-module`. Validado contra Postgres real (não só tsc).

| # | Task | Critério de aceite |
|---|---|---|
| T3.1 | `pgSchema('meta_whatsapp')` + tabelas `sessions`, `messages` + migrations com journal `meta_whatsapp_migrations` | `runMetaWhatsAppMigrations(db)` aplica limpo em banco vazio |
| T3.2 | Repositórios de sessão e mensagem (getContext, setState, setMode, requestHuman, markRead, markAllRead, listByContextFilters, insertMessage, updateMessageStatus) | Testes unitários com banco de teste |
| T3.3 | Use-cases: takeover/release, log, export, listagem | — |
| T3.4 | Realtime: `SseHub` + relay Redis + ticket 60s, atrás de `RealtimeNotifierInterface` | Host pode trocar por WebSocket ou desligar |
| T3.5 | Multiempresa: `companyId` vindo do contexto autenticado, índices incluindo tenant | Teste negativo de isolamento entre tenants |

**Verificação:** `tsc --noEmit && bun test` · **lint de fronteira: zero import de `channel/`**

---

## Fase 4 — `module/conversations/flows/` (fluxograma) ✅ CONCLUÍDA (T4.1-T4.3)
> 🤖 Modelo: `sonnet` · T4.3 é 🧠 `opus` (executada em sonnet — flag se precisar revisão)
> Depende de: F2 · paralelizável com F3 e F5

| # | Task | Critério de aceite |
|---|---|---|
| T4.1 ✅ | Tabela `flow_graphs` (key, label, start_node_id, nodes, version) + migrations | — |
| T4.2 ✅ | CRUD de grafo + `GetLiveFlowPositions` | Paridade com `modules/flows/**` do bot |
| T4.3 ✅ | Interpretador de grafo + **registro de actions do host** (`registerFlowAction`) | `trigger_simulation` do bot funciona registrado de fora, sem estar no pacote |
| T4.4 | Flag `features.flowEngine` — desligável | Adiada para T5.6 (`createMetaWhatsAppModule()`) — não há factory pra ter flag ainda |

**Verificação:** `tsc --noEmit && bun test` · lint de fronteira

---

## Fase 5 — `module/channel/` (Meta/WhatsApp)
> 🤖 Modelo: `sonnet` · T5.1 e T5.6 são 🧠 `opus` (segurança e API pública)
> Depende de: F2

| # | Task | Critério de aceite |
|---|---|---|
| T5.1 🧠 | Webhook: verify (compare constante), HMAC `sha256=`, nonce anti-replay Redis TTL 300s | Testes: assinatura inválida → rejeita; replay → rejeita; sempre 200 ao Meta |
| T5.2 | `sender`: wrapper do `meta-whatsapp-provider` — texto, mídia, template, lista interativa; erro de janela 24h → `WINDOW_EXPIRED` | Paridade com `WhatsAppSender.ts:46-105` |
| T5.3 | `media`: download/upload Meta, idempotente por `sourceMediaId`, via `ObjectStorageInterface` | **Sem reimplementar S3** — delega ao `object-storage-provider` |
| T5.4 | **Corrigir dívida:** outbound deixa de gravar base64 no banco; grava no storage e referencia `uploadId` | `messages.payload` não contém binário |
| T5.5 | `settings`: tabela `meta_whatsapp.settings` (só chaves de WhatsApp) + CRUD de templates/welcome/farewell/variáveis | Não usa o `app_config` do host |
| T5.6 🧠 | `createMetaWhatsAppModule()` + `registerRoutes()` — costura conversa×canal, hooks, portas, `CatalogPort` **opcional** | Sem catálogo injetado, módulo sobe e funciona |

**Verificação:** `tsc --noEmit && bun test` · zero `process.env` no pacote

---

## Fase 6 — `conversations-ui`: design, áudio, documentos
> 🤖 Modelo: `haiku` em T6.1 · `sonnet` no resto
> Depende de: F2
> ⚠️ **Maior esforço do projeto.** Paridade visual é critério de aceite.

| # | Task | Critério de aceite |
|---|---|---|
| T6.1 | **Desacoplar locale primeiro** — remover import do barrel pt-BR dos componentes; strings via props/context com default pt-BR | Zero import de `locales` do produto. **Bloqueia todas as tasks seguintes** |
| T6.2 | Tokens: reconciliar `tailwind.config.js:27-40` e `theme.constant.ts` numa fonte única exportada | Uma definição só de `whatsapp.*` |
| T6.3 | **Wallpaper** `.wa-wallpaper` (`index.css:119-129`) — SVG data-URI, claro `#d7cfc0` / escuro `#19232a` | Screenshot idêntico ao bot, claro e escuro |
| T6.4 | `MessageBubble` + `Ticks` + `Avatar` + `DateDivider` | Cor por sender, tail só no `isFirstInGroup`, agrupamento `mt-2`/`mt-0.5`, `ring-1 ring-red-400` em falha, tick `read → sky-500`, tooltip de `readAt`/janela expirada |
| T6.5 | Formatação: `whatsapp-formatting.tsx` (`*bold*`, `_italic_`, `` `code` ``, `waToHTML`/`htmlToWA`) + `WhatsAppMessageEditor` + `SimpleEmojiPicker` | Round-trip WA↔HTML sem perda |
| T6.6 | `AudioPlayer` — **paridade primeiro** (waveform fake de 30 barras, click-to-seek, `m:ss`) | Idêntico ao bot. Waveform real, velocidade, gravador e STT ficam como *enhancement* pós-paridade |
| T6.7 | Documentos: `ImageLightbox`, download por URL assinada, aceite `image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.zip` | Paridade |
| T6.8 | **Melhorias** sobre as lacunas: ícone por extensão (hoje é `FileText` para tudo) e tamanho formatado na bolha | Não regride paridade |
| T6.9 | Camada headless: hooks/queries exportados independentes das telas | Produto consegue montar tela própria sobre os hooks |

**Verificação:** `tsc --noEmit && bun test` · **screenshots antes/depois por componente,
claro e escuro** · Storybook ou página de sandbox

---

## Fase 7 — `conversations-ui`: settings + editor de fluxograma
> 🤖 Modelo: `sonnet`
> Depende de: F6.1 (desacople de locale)

| # | Task | Critério de aceite |
|---|---|---|
| T7.1 | Telas de Settings do WhatsApp: template (picker + refresh da Meta), idioma, variáveis dinâmicas, welcome, farewell | Paridade com `SettingsPage.tsx:517-876` |
| T7.2 | Editor de fluxograma no subpath `./flows` — 9 componentes + blueprint (~2.233 linhas) | Importar `conversations-ui` **sem** `/flows` não puxa React Flow (verificar no bundle) |
| T7.3 | `FlowWhatsAppPreview` passa a consumir a bolha do pacote em vez de duplicar estilo | Zero duplicação de estilo de bolha |

**Verificação:** `tsc --noEmit` · análise de bundle provando o code-split

---

## Fase 8 — Primeiro consumidor
> 🤖 Modelo: `sonnet` · revisão 🧠 `opus`
> Depende de: F3, F4, F5, F6, F7

> ✅ **RESOLVIDA — QuickCart migra primeiro.** Decisão do usuário: QuickCart primeiro,
> comparação visual contra o bot (baseline conhecido) depois de migrado, bot migra em
> seguida na Fase 9. Branch de migração do bot ainda não identificada — resolver ao
> iniciar a Fase 9.

| # | Task | Critério de aceite |
|---|---|---|
| T8.1 | Instalar o trio; remover código duplicado do produto | Produto não tem mais webhook/sender/schema próprios |
| T8.2 | Plugar regra de negócio nos hooks (`onMessageReceived`) | Bot: forward n8n + actions de simulação. QuickCart: engine em TS |
| T8.3 | Migrar dados existentes para o schema `meta_whatsapp` | Migration reversível, testada em cópia de produção |
| T8.4 | Injetar portas do produto (`SubjectResolver`, storage, cache, realtime) | — |
| T8.5 🧠 | Revisão de regressão: funcional + **visual por screenshot** | Zero regressão |

**Verificação:** `make validate` do produto · smoke test de conversa ponta a ponta

---

## Fase 9 — Segundo consumidor
> 🤖 Modelo: `sonnet` · revisão 🧠 `opus`
> Depende de: F8

Mesmas tasks da F8 para o outro produto. **É esta fase que prova a extração** — se algo
precisar mudar no pacote aqui, é sinal de que a fronteira ficou errada.

| # | Task | Critério de aceite |
|---|---|---|
| T9.1 | Integrar o trio no 2º produto | — |
| T9.2 | Registrar toda customização que exigiu mudança no pacote | Se exigiu porta nova, abrir PR no pacote — **nunca** editar `node_modules` nem forkar |

---

## Fase 10 — Publicação
> 🤖 Modelo: **`opus` — gate obrigatório**
> Depende de: F9

| # | Task | Critério de aceite |
|---|---|---|
| T10.1 | README de cada pacote: instalação, factory, portas, exemplo de host | — |
| T10.2 | Changesets + semver + notas de migração | Major documentada |
| T10.3 🧠 | **Revisão final:** checklist da spec §11, auditoria de segurança e performance, zero regra de negócio de produto nos pacotes | Aprovação explícita antes do `publish` |

---

## Pendências que travam o início

1. ✅ **RESOLVIDA** — QuickCart migra primeiro na F8; bot migra na F9.
2. **[NEEDS CLARIFICATION]** Qual a branch de migração do bot? Não encontrada. Resolver
   ao iniciar a Fase 9.
3. **[NEEDS CLARIFICATION]** Q3 da spec — tabelas `uploads`/`upload_*_links` entram no
   módulo? *Reco:* não; módulo tem `meta_whatsapp.media`, `uploads` genérica fica no produto.
4. **[NEEDS CLARIFICATION]** Q4 da spec — settings em tabela do módulo?
   *Reco:* sim, `meta_whatsapp.settings` só com chaves de WhatsApp.

⚠️ **Ação independente e urgente:** token da Meta aparentemente real em texto plano em
`packages/backend/meta-business/catalog/readme.md:13` — revogar e rotacionar.
