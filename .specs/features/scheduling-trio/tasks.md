# SCH — Tasks

Spec: `.specs/features/scheduling-trio/spec.md`
Gate ao fim de **cada** task: `pnpm --filter=<pacote> exec tsc --noEmit` + testes do pacote +
commit isolado (`model-economy.md` §3).

Worktree sugerido: `~/Documents/personal/adatechnology-scheduling`, branch `feat/scheduling-trio`.

**Herança do trio de catálogo:** `@adatechnology/module-http` já existe publicado (`0.1.0-rc.1`) e
carrega o encanamento HTTP — tabela de rotas declarativa, adaptadores `fetch`/`uws` e teste de
contrato compartilhado. Este trio consome ele **desde a primeira linha**. Copiar o encanamento para
dentro do pacote é o erro que o `notification-module` ainda está pagando (ver "Bloqueios" do
`catalog-trio/tasks.md`).

---

## Fase 0 — Contrato e decisões
> 🤖 Modelo: `opus` 🧠

- ✅ **T0.1** Spec escrita: granularidade (uma capacidade, dois cenários), teste do prefixo,
      modelo de dados, portas, eventos e critérios de aceite.
- **T0.2** Fechar as quatro decisões abertas da §12. Todas têm recomendação e **nenhuma bloqueia
      as Fases 1–4**; Q1 (reserva recorrente) e Q3 (lista de espera) precisam estar fechadas antes
      da Fase 7, porque mudam a tela de agenda.

---

## Fase 1 — `scheduling-contracts`
> 🤖 Modelo: `sonnet`

- **T1.1** Pacote + exports map, no molde do `catalog-contracts`.
- **T1.2** Tipos e schemas zod das entidades: `Resource`, `Service`, `AvailabilityRule`,
      `AvailabilityException`, `Booking`, `BookingSlot`, `BookingParticipant`, `AvailableSlot`.
      `timezone` é string IANA **validada** — zod com checagem contra `Intl.supportedValuesOf`,
      não `z.string()` solto: fuso inválido só apareceria no cálculo, semanas depois.
- **T1.3** Portas: `VideoMeetingPort`, `CalendarSyncPort`, `ClockPort`, `LoggerPort`.
      `CalendarSyncPort` já nasce com o método de leitura **declarado** mesmo sem implementação —
      adicionar depois seria breaking change (§8 da spec).
- **T1.4** Erros de domínio estendendo `DomainError`, com códigos centralizados:
      `SlotUnavailableError` (409), `CancellationTooLateError` (409), `BookingInPastError` (400),
      `ResourceUnavailableError` (409), `ServiceNotOfferedByResourceError` (400).
- **T1.5** Os 7 eventos da §8 com payload tipado. `booking.rescheduled` carrega a faixa **anterior**
      — sem ela o consumidor não consegue avisar "mudou de X para Y".
- **T1.6** `strictness.test.ts` no molde do `catalog-contracts`: schema recusa campo desconhecido.

---

## Fase 2 — `scheduling-module`: dados
> 🤖 Modelo: `sonnet` (T2.3 é 🧠 — a `EXCLUDE` não é Drizzle padrão)

- **T2.1** Pacote + `database.types.ts` (`PgDatabase` genérico + `DrizzleMigrateFunction` injetado,
      molde do `meta-whatsapp-module`) + exports map.
- **T2.2** `schema/schema.ts` em `pgSchema('scheduling')` com as 8 tabelas da §5. Atenção ao que a
      spec justifica: `bookings.serviceId` nullable (reunião ad-hoc), `resources.timezone` no
      recurso e não na empresa, `booking_slots` com `during` **e** `blocking` separados.
- **T2.3** 🧠 Migration com `CREATE EXTENSION IF NOT EXISTS btree_gist` e a constraint de exclusão
      em `booking_slots`. O drizzle-kit não gera `EXCLUDE USING gist` — é SQL escrito à mão na
      migration, e o snapshot precisa ser conferido para não regenerar sem ela.
      **Aceite:** teste de integração que tenta inserir dois slots sobrepostos do mesmo recurso e
      recebe violação de constraint.
- **T2.4** Índices GIST em `booking_slots(resourceId, during)` e
      `availability_exceptions(resourceId, during)` — a consulta de disponibilidade é interseção de
      intervalo, e sem GIST ela varre a tabela.
- **T2.5** Migrations pelo drizzle-kit **do pacote** + `runSchedulingMigrations` com journal
      `scheduling_migrations` fora do pgSchema (motivo em `meta-whatsapp-module/runMigrations.ts`).
- **T2.6** Repositories: `ResourceRepository`, `ServiceRepository`, `AvailabilityRepository`,
      `BookingRepository`. Toda condição alcançável por requisição de usuário é **função pura
      exportada**, para o teste de isolamento travar a mesma função que a produção chama.
- **T2.7** Teste de isolamento multiempresa por renderização de SQL (`PgDialect`), sem Postgres real.
- **T2.8** `testing/inMemoryRepositories.ts` para os consumidores testarem sem banco — molde do
      `notification-module`. **Documentar o limite:** a versão em memória não reproduz a constraint
      de exclusão, então teste de conflito é integração, nunca unitário.

---

## Fase 3 — Disponibilidade
> 🤖 Modelo: `sonnet` 🧠 (fuso e DST)

- **T3.1** `ListAvailableSlots` implementando a fórmula da §7: fatias das regras semanais na janela,
      menos exceções `block`, mais exceções `extra`, menos `blocking` das reservas.
- **T3.2** 🧠 Conversão hora-de-parede → instante pelo timezone do recurso, via `AT TIME ZONE` com
      zona nomeada (nunca offset fixo).
      **Aceite:** teste de DST em `Europe/Lisbon` com datas fixas cruzando a virada — a regra de
      09:00 continua às 09:00 locais nos dois lados. Relógio pelo `ClockPort`, nunca `new Date()`.
- **T3.3** Fatiamento pelo passo `durationMinutes + bufferBefore + bufferAfter` do serviço, com
      `resource_services` filtrando quem atende o quê.
      **Aceite:** dois atendimentos colados sem buffer entre eles não aparecem ambos como livres.
- **T3.4** `validFrom`/`validUntil` das regras respeitados — é como se troca o expediente numa data
      futura sem apagar o histórico do que valia antes.
- **T3.5** Janela máxima consultável limitada por config (`maxLookaheadDays`), com erro de validação
      acima disso. Consulta de 5 anos é varredura acidental.

---

## Fase 4 — Reservas
> 🤖 Modelo: `sonnet` 🧠 (concorrência e transação)

- **T4.1** 🧠 `RequestBooking` **transacional**: grava `bookings`, `booking_slots` (uma linha por
      recurso) e `booking_participants` numa transação só. Violação da constraint é convertida em
      `SlotUnavailableError`, nunca erro cru do Postgres vazando para o cliente.
      **Aceite:** duas reservas simultâneas do mesmo recurso e horário — uma falha.
- **T4.2** 🧠 **Teste de concorrência de reunião**: duas reuniões simultâneas compartilhando um
      participante em comum — uma falha. É o que prova que `booking_slots` por recurso funciona; sem
      ele o caso passa despercebido.
- **T4.3** Idempotência por `Idempotency-Key`: unique parcial `(companyId, idempotencyKey)`, replay
      devolve a reserva existente com `200`, não `201` (`apis.md`).
- **T4.4** `ConfirmBooking` respeitando `requiresConfirmation` por serviço. Reserva `requested`
      **ocupa a agenda** — recusar depois libera o slot (§9.2 da spec).
- **T4.5** 🧠 `RescheduleBooking`: apaga os slots antigos e insere os novos **na mesma transação**.
      **Aceite:** remarcação que bate na constraint não deixa a reserva sem slot.
- **T4.6** `CancelBooking` apagando as linhas de slot e mantendo `status: 'cancelled'` na reserva.
      Recusa dentro de `minCancellationNoticeMinutes` com `CancellationTooLateError`; `0` desliga.
- **T4.7** `CompleteBooking`, `MarkNoShow`, `GetBooking`, `ListBookings` paginado com filtro por
      recurso, status e período.
- **T4.8** Reserva no passado recusada na criação e na remarcação, com tolerância configurável.
- **T4.9** `VideoMeetingPort` chamado na confirmação; **falha não bloqueia** a reserva — grava sem
      link e emite o evento (§9.6 da spec).
- **T4.10** `createSchedulingModule({ db, config, providers, hooks })` validando config e falhando
      **no boot** quando uma feature está ligada sem a porta correspondente — molde do
      `MetaSyncDisabledError` do catálogo.
- **T4.11** Auditoria de PII automatizada no molde do `piiAudit.test.ts`: nenhuma coluna do schema
      guarda nome, telefone, e-mail ou documento.

---

## Fase 5 — HTTP
> 🤖 Modelo: `sonnet`

- **T5.1** Tabela de rotas declarativa sobre `@adatechnology/module-http`: método, path, escopo,
      schemas zod, handler puro. Nenhum tipo de framework no módulo.
- **T5.2** Adaptadores `./http/fetch` e `./http/uws` com o teste de contrato compartilhado — e um
      teste de paridade com as **rotas reais**, não sintéticas (foi o defeito 4 do gate do catálogo).
- **T5.3** Teste de autorização por objeto: reserva de outra empresa devolve 404, nunca 403.
- **T5.4** `./openapi` derivado da mesma tabela, com teste que quebra se rota nova ficar sem
      documentação.
- **T5.5** Rotas de calendário externo **não são publicadas** quando `CalendarSyncPort` está ausente.

---

## Fase 6 — Lembretes
> 🤖 Modelo: `sonnet`

- **T6.1** `SweepDueReminders`: lê confirmadas com início na janela de antecedência e
      `reminderSentAt` nulo, emite `booking.reminder_due`, marca o campo **na mesma transação**.
- **T6.2** **Aceite de idempotência:** duas varreduras simultâneas não emitem o lembrete duas vezes.
- **T6.3** `createSchedulingWorker({ db, queue })` com `QueuePort` injetado, nunca conexão própria.
- **T6.4** README documentando a armadilha do `quietHours` (§10 da spec): lembrete pode ser adiado
      para depois do compromisso, e a decisão é do produto que liga os dois módulos.

---

## Fase 7 — `scheduling-ui`
> 🤖 Modelo: `sonnet`

- **T7.1** Camada headless: `useAvailableSlots.query.ts`, `useBookings.query.ts`,
      `useRequestBooking.mutation.ts`, `useRescheduleBooking.mutation.ts`. TanStack Query **do
      host**, nunca instanciado no pacote.
- **T7.2** `SchedulingWorkspace` composto, com `labels` e slots de render. Áreas: agenda, reservas,
      recursos, serviços, disponibilidade.
- **T7.3** Grade de agenda (dia/semana por recurso) com sobreposição visual. É a tela cara e é
      exatamente a que cada produto remontaria diferente — por isso ela nasce no pacote (§4 da regra).
- **T7.4** Editor de disponibilidade: regras semanais + exceções, com o fuso do recurso **visível**
      na tela. Editar expediente sem ver o fuso é como o erro entra.
- **T7.5** Tabela de reservas cumprindo `web.md` §7: ordenação, filtro múltiplo, seleção em lote,
      limpar filtros, tudo refletido em query params.
- **T7.6** Locales `*.locale.json`, tokens de tema, ícones `lucide-react` avaliados por ação
      (`web.md` §9), área de toque `min-h-11`, responsivo a 375/768/1280.

---

## Fase 8 — `web-booking-widget`
> 🤖 Modelo: `sonnet`

- **T8.1** Web Component nativo, no molde do `web-chat-widget`: escolha de serviço, recurso e
      horário, com confirmação.
- **T8.2** Fala com a **API do produto**, nunca com rota anônima do módulo (Q2 da spec).
- **T8.3** Tokens de tema injetados por atributo; sem cor própria.
- **T8.4** Horário exibido no fuso do **visitante**, com o fuso do recurso indicado. Cliente em outro
      estado marcando "14:00" e chegando às 15:00 é o bug clássico desta tela.

---

## Fase 9 — Publicação
> 🤖 Modelo: `haiku` para T9.1, **`opus` obrigatório** para T9.3

- **T9.1** README dos pacotes (pt-BR, padrão do `fiscal-provider`): instalação,
      `createSchedulingModule`, portas de extensão, exemplo de host.
- **T9.2** Changeset em inglês com o porquê de cada decisão, destacando migrations incluídas e a
      extensão `btree_gist` que o host precisa permitir.
- **T9.3** **Gate de revisão com `opus`** (§5 da regra): checklist da §13 da spec, caça a bug de
      lógica/concorrência/segurança, zero `process.env`, zero regra de produto no módulo,
      migrations append-only.

---

## Fora de escopo, registrado

- **Capacidade > 1** (turma, aula em grupo): troca a restrição de sobreposição por uma de contagem,
  que `EXCLUDE` não expressa (§5.4 da spec). É o que arrebenta primeiro se aparecer consumidor de
  academia ou curso.
- **Reserva recorrente** (série semanal): a parte cara é exceção por ocorrência, não o campo (Q1).
- **Sincronização bidirecional de calendário**: exige webhook, sync token e resolução de conflito —
  capacidade inteira, não flag (§8).
- **Lista de espera** (Q3): evolução sem breaking change, com `booking.cancelled` como gatilho.
- **Cobrança e sinal**: do produto, plugado em `booking.confirmed`.

---

## Dependências de infraestrutura

- **`btree_gist`** precisa estar disponível no Postgres do host — sem ela o desenho de conflito
  inteiro cai. ✅ **Conferido no ambiente local** (`ada-dev-postgres`, Postgres 17.10): disponível
  na versão 1.7, ainda não instalada, e a migration da T2.3 a instala. Falta conferir no Postgres
  de produção antes da Fase 2 chegar lá: Postgres gerenciado com allowlist de extensão pode recusar.
- **Postgres real para os testes de constraint.** A repository em memória não reproduz `EXCLUDE`;
  os aceites de T2.3, T4.1, T4.2 e T4.5 rodam em integração (`env.test.e2e`).
