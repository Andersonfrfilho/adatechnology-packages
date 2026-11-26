---
'@adatechnology/content-contracts': minor
'@adatechnology/content-module': minor
'@adatechnology/content-ui': minor
---

Conteúdo: agendamento que publica de verdade, modelos, republicar e recorrência.

- `content-module`: `publishDue({ now })` idempotente e seguro entre instâncias (`FOR UPDATE SKIP LOCKED`) e `startContentScheduler`; modelos (`isTemplate`, salvar como modelo, novo a partir de modelo); `republishPost` mantém o mesmo endereço (SEO) e recusa data futura; recorrência semanal/mensal; contagem por aba; id curto por post (`<shortId>-<slug>`), histórico de slug, slug automático curto e rótulos de tag. Migration `0001` aditiva (rode `runContentMigrations`). **`PostStorePort` ganhou métodos** (hosts com store próprio precisam implementá-los).
- `content-contracts`: `Post.isTemplate`/`shortId`/`tagLabels`, `PostCounts`, `RecurrenceRule`, schemas novos, `buildShortSlug`, `buildPostPath`/`parsePostPath`/`parsePostRef`, `formatTagLabel`/`buildTagLabels`. O slug automático agora é curto (sem palavras de ligação).
- `content-ui`: abas com contagem, ações por linha, diálogos de modelo e republicar, painel de recorrência, `Tooltip`, `renderSelect`/`renderDateTimeInput`, rótulo de tag e correção do contraste do chip de tag ativo. Tudo novo é opt-in pela API injetada.
