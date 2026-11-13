# Spec — Trio plugável `scheduling`

Agendamento de serviços e de reuniões como capacidade reutilizável, com link de vídeo e
sincronização de calendário externo como integrações **opcionais**.

Regra de referência: `~/.claude/rules/rules/packages/pluggable-module.md`.
Companheiras: `.specs/features/notification-trio/spec.md` (entrega os lembretes) e
`.specs/features/catalog-trio/spec.md` (mesmo desenho de portas e prefixo).

> **Status:** 📐 desenhado aqui, nada implementado. Escrita em 2026-08-14.
> Escopo decidido com o usuário: **os dois cenários** (cliente agenda serviço + reunião interna)
> desde a primeira versão, e a capacidade **nasce pacote**, como foi feito com `catalog-*`.

---

## 1. Por que `scheduling-*` e não `google-scheduling-*`

Teste do prefixo (§2 da regra): **a capacidade existe sem o fornecedor?** Existe inteira. Definir
disponibilidade, calcular horários livres, reservar sem conflito, remarcar e lembrar funciona sem
Google, sem Outlook e sem nenhum calendário externo. Espelhar no Google Calendar é integração
opcional atrás de `CalendarSyncPort`, desligada por padrão.

O SDK stateless que fala com o fornecedor é que carrega o prefixo: `google-calendar-provider`,
no mesmo molde do `meta-catalog-provider`.

---

## 2. Uma capacidade, dois cenários

"Agendar serviço" e "marcar reunião" **não são dois trios**. Aplicando o teste de granularidade
(§2 da regra): elas não são independentes uma da outra — são a mesma coisa. O núcleo é idêntico:
um recurso com disponibilidade, uma faixa de tempo, participantes, e a garantia de não sobrepor.

O que difere é periférico, e cada diferença vira porta ou ausência:

| | Cliente agenda serviço | Reunião interna |
|---|---|---|
| Quem reserva | o cliente, pela ponta pública | o operador, pelo painel |
| Recursos envolvidos | um (o profissional/sala) | vários (os participantes) |
| Serviço catalogado | sim, com duração e preço | opcional — reunião ad-hoc não tem serviço |
| Link de vídeo | normalmente não | normalmente sim |

Nenhuma dessas linhas justifica um segundo trio. Empacotar separado forçaria todo consumidor a
carregar duas modelagens de tempo, duas migrations e dois ciclos de versão para o mesmo problema.

**Capacidade opcional por ausência:** sem `VideoMeetingPort` não existe link e a UI não desenha o
affordance. Quem só agenda corte de cabelo nunca vê a palavra "reunião" — não há flag `hasMeetings`.

---

## 3. Anatomia

```text
packages/backend/
├── scheduling-contracts/     @adatechnology/scheduling-contracts     ← tipos, zod, portas, eventos
├── scheduling-module/        @adatechnology/scheduling-module        ← schema, migrations, rotas, worker
└── google-calendar-provider/ @adatechnology/google-calendar-provider ← SDK do fornecedor (opcional)
packages/frontend/
├── scheduling-ui/            @adatechnology/scheduling-ui            ← SchedulingWorkspace (painel)
└── web-booking-widget/       @adatechnology/web-booking-widget       ← ponta pública (Web Component)
```

`pgSchema('scheduling')`, journal `scheduling_migrations`.

O módulo **não importa** o `google-calendar-provider` nem o `notification-module`. Quem só agenda
internamente não carrega cliente de OAuth do Google.

A ponta pública é pacote separado, e não uma tela do `scheduling-ui`, pelo mesmo motivo que o
`web-chat-widget` é separado do `conversations-ui` (`web.md` §1): ela roda fora do React do painel,
em site institucional ou link direto, então é Web Component nativo.

---

## 4. O que este módulo **não** faz

Delimitar isto agora é o que impede o módulo de virar fork disfarçado no primeiro consumidor.

- **Não entrega lembrete.** O `notification-module` já tem fila, worker, `quietHours` e auditoria
  de PII. Agendamento decide **quando**; notificação decide **como** e **se pode agora**. O módulo
  emite `booking.reminder_due` e o produto liga os dois — exatamente como catálogo e WhatsApp se
  falam sem se importar (§2 da regra).
- **Não guarda dado pessoal.** Ver §6.
- **Não conhece usuário.** Profissional e participante entram como referência opaca do produto
  (`externalRef`), nunca como tabela de usuários do módulo.
- **Não decide política comercial.** Janela mínima de cancelamento é config; multa por no-show,
  sinal, comissão e preço dinâmico são do produto, plugados nos eventos. Qualquer um desses
  virando `if` dentro do módulo é rejeitado em code review (§6 da regra).

---

## 5. Modelo de dados — `pgSchema('scheduling')`

`varchar` em vez de ENUM (`code-standart.md` §8), `companyId` em toda tabela vindo do contexto
autenticado, PK UUID.

| Tabela | Colunas relevantes | Índices |
|---|---|---|
| `resources` | `companyId`, `name`, `kind`, `timezone`, `externalRef`, `active`, `deletedAt` | uniq `(companyId, name)` where not deleted · `(companyId, active)` |
| `services` | `companyId`, `name`, `description`, `durationMinutes`, `bufferBeforeMinutes`, `bufferAfterMinutes`, `priceInCents`, `requiresConfirmation`, `minCancellationNoticeMinutes`, `active`, `sortOrder`, `deletedAt` | uniq `(companyId, name)` where not deleted · `(companyId, active, sortOrder)` |
| `resource_services` | `companyId`, `resourceId`, `serviceId` | uniq `(companyId, resourceId, serviceId)` |
| `availability_rules` | `companyId`, `resourceId`, `weekday`, `startsAtLocal`, `endsAtLocal`, `validFrom`, `validUntil` | `(companyId, resourceId, weekday)` |
| `availability_exceptions` | `companyId`, `resourceId`, `during`, `kind`, `reason` | GIST `(resourceId, during)` |
| `bookings` | `companyId`, `serviceId` (nullable), `title`, `status`, `customerRef`, `organizerRef`, `meetingUrl`, `externalCalendarId`, `notes`, `cancelledAt`, `cancelledBy`, `cancellationReason`, `reminderSentAt`, `idempotencyKey` | uniq `(companyId, idempotencyKey)` where not null · `(companyId, status, startsAt)` |
| `booking_slots` | `bookingId`, `resourceId`, `during`, `blocking` | **EXCLUDE** `(resourceId =, blocking &&)` · GIST `(resourceId, during)` |
| `booking_participants` | `bookingId`, `participantRef`, `resourceId` (nullable), `role`, `responseStatus` | `(bookingId)` |

### 5.1 A tabela que faz os dois cenários caberem: `booking_slots`

A faixa reservada **não fica na reserva, fica por recurso**. Uma reserva é o compromisso lógico;
`booking_slots` é o que cada agenda consome.

- Serviço com um profissional → 1 linha.
- Reunião com três participantes → 3 linhas, uma por agenda.

Sem essa separação, a constraint de sobreposição protegeria só o recurso "principal" e uma reunião
poderia ser marcada por cima do atendimento de dois dos três participantes. Com ela, a mesma
constraint protege os dois cenários sem nenhum caso especial.

**Cancelar apaga as linhas de slot**, e a reserva guarda `status: 'cancelled'` para histórico. Isso
evita denormalizar `status` no slot só para alimentar um índice parcial — e denormalização de status
é exatamente o tipo de campo que sai de sincronia sem ninguém perceber. Remarcar é apagar e inserir
na mesma transação, e a constraint valida o novo horário atomicamente.

### 5.2 Conflito é constraint de banco, não `if` no use case

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE scheduling.booking_slots
  ADD CONSTRAINT booking_slot_no_overlap
  EXCLUDE USING gist (resource_id WITH =, blocking WITH &&);
```

Checar-antes-de-inserir perde para concorrência sempre: dois clientes no mesmo segundo passam os
dois pela checagem e a agenda fica com dois atendimentos no mesmo horário. Com duas instâncias da
API é garantido. A constraint torna a sobreposição **impossível**, independente de quantos processos
existam — mesmo raciocínio do `ConsumeInventory` do catálogo, com a ferramenta certa para intervalos.

**`during` e `blocking` são faixas diferentes, de propósito.** `during` é o contrato com o cliente
(14:00–15:00). `blocking` é o que a agenda realmente consome, com os buffers do serviço
(13:50–15:15). Se a constraint usasse a faixa visível, dois atendimentos colados passariam e o
profissional não teria como se deslocar entre eles. A ponta pública mostra `during`; o banco protege
`blocking`.

### 5.3 Fuso horário — onde isto quebra em silêncio

- **Reserva guarda instante** (`tstzrange`, UTC).
- **Regra de disponibilidade guarda hora de parede** (`time`) mais o **IANA timezone do recurso** —
  nunca UTC.

Converter "seg 09:00–18:00" para UTC no cadastro parece inofensivo e vira 08:00 local na virada do
horário de verão. O Brasil não tem mais DST, mas o módulo é genérico: o primeiro cliente em Portugal
ou no Chile descobre o bug pelo cliente que chegou na hora errada — e descobre em produção, porque
teste que roda em data fixa nunca cruza a virada.

O timezone fica **no recurso, não na empresa**: uma conta pode ter profissional em Manaus e outro em
São Paulo.

### 5.4 Sem `capacity` — decisão explícita

Turma, aula em grupo e sala com N lugares ficam **fora da v1**.

Capacidade maior que 1 transforma a restrição de sobreposição numa restrição de **contagem**, e
`EXCLUDE` não expressa contagem. Suportar isso exige linha de contador com lock, ou contar reservas
dentro da transação com `SERIALIZABLE` — outra classe de problema, com outra classe de bug.

Fica registrado como o que arrebenta primeiro se um consumidor de academia ou de curso aparecer.

---

## 6. LGPD — o módulo não guarda PII

`bookings` guarda `customerRef` e `organizerRef`: **referências opacas** do produto. Nome, telefone
e e-mail do cliente ficam onde já estão, no produto, e o `notification-module` resolve o destinatário
na hora do envio.

É o mesmo princípio do §6 de `security.md` ("payload de job carrega referência, não dado pessoal"),
aplicado ao repouso. O ganho prático: o schema de agendamento inteiro pode ser exportado para
depuração sem vazar cliente nenhum, e uma requisição de exclusão de dados não precisa varrer o
módulo.

Para a ponta pública, onde o cliente ainda não existe no produto: o produto cria o contato **antes** e
passa a referência. Quem cria contato é o produto, não o agendamento.

`notes` é campo livre e pode receber PII digitada pelo operador — entra na auditoria de PII do
pacote, no mesmo molde do `piiAudit.test.ts` do `notification-module`, e nunca vai para log.

---

## 7. Disponibilidade é calculada, nunca materializada

```text
livres(recurso, janela, serviço) =
      fatias(regras semanais ∩ janela, passo = duração + buffers)
    − exceções kind='block'
    + exceções kind='extra'
    − booking_slots.blocking do recurso
```

Gravar slots livres significa escrever linhas até o infinito e um job noturno que derrapa: mudar uma
regra de expediente obrigaria a regerar meses de linhas, e qualquer falha no meio deixa a agenda
mentindo. O cálculo na leitura é barato — a janela consultada é de dias, não de anos, e o GIST
responde a interseção.

`kind='extra'` é o encaixe fora do expediente, que existe em toda agenda real e que uma modelagem
só-com-bloqueio obriga a resolver editando a regra semanal.

---

## 8. Portas e eventos

| Porta | Default | Ausente significa |
|---|---|---|
| `VideoMeetingPort` | ausente | agendamento presencial, sem link, sem affordance na UI |
| `CalendarSyncPort` | desligada | sem espelho no Google/Outlook |
| `ClockPort` | relógio real | — (obrigatória na prática: testar lógica de tempo sem controlar o relógio é escrever teste instável) |
| `LoggerPort` | ausente | módulo silencioso |

**Sincronização de calendário é one-way (push) na v1.** Bidirecional exige webhook do fornecedor,
sync token incremental e política de resolução de conflito — é uma capacidade inteira, não um flag.
Entra quando um consumidor precisar, e o contrato da porta já nasce com o método de leitura
declarado para não virar breaking change.

**Eventos** (tipados no `-contracts`): `booking.requested`, `booking.confirmed`,
`booking.rescheduled` (carrega a faixa anterior), `booking.cancelled` (ator e motivo),
`booking.reminder_due`, `booking.completed`, `booking.no_show`.

---

## 9. Use-cases

| Grupo | Use-cases |
|---|---|
| Recurso | `CreateResource`, `UpdateResource`, `DeleteResource` (soft), `ListResources` |
| Serviço | `CreateService`, `UpdateService`, `DeleteService` (soft), `ListServices` |
| Disponibilidade | `SetAvailabilityRules`, `AddAvailabilityException`, `RemoveAvailabilityException`, `ListAvailableSlots` |
| Reserva | `RequestBooking`, `ConfirmBooking`, `RescheduleBooking`, `CancelBooking`, `CompleteBooking`, `MarkNoShow`, `GetBooking`, `ListBookings` |
| Lembrete | `SweepDueReminders` |

**Regras que o módulo carrega:**

1. **`RequestBooking` é idempotente por `Idempotency-Key`** (`apis.md`). Repetição devolve `200` com
   a reserva existente, não `201` com uma segunda. Sem isso, retry de rede em conexão móvel duplica
   agendamento — e o cliente que tocou duas vezes no botão criou dois.
2. **`requiresConfirmation` é por serviço.** Reunião interna nasce `confirmed`; atendimento que o
   dono quer aprovar nasce `requested` e ocupa a agenda mesmo assim — recusar depois libera o slot, e
   é melhor que dois clientes pedirem o mesmo horário enquanto ninguém aprovou.
3. **Cancelar dentro da janela mínima é recusado** (`CancellationTooLateError`, 409), com
   `minCancellationNoticeMinutes` por serviço. `0` desliga a regra.
4. **Remarcar é transação única**: apaga os slots antigos e insere os novos. Falhou a constraint,
   nada mudou — nunca existe o estado intermediário de reserva sem horário.
5. **Reserva no passado é recusada** na criação e na remarcação, com tolerância configurável. Marcar
   retroativo é registro de atendimento, não agendamento, e merece caminho próprio se alguém pedir.
6. **Link de vídeo nunca bloqueia a reserva.** Falha do `VideoMeetingPort` grava a reserva sem link
   e emite o evento; provedor fora do ar não pode impedir marcar reunião — mesmo desenho do
   "sync com a Meta nunca bloqueia o salvamento" do catálogo.

---

## 10. Lembretes — varredura, não job atrasado

`SweepDueReminders` roda periodicamente, lê as reservas confirmadas cujo início cai na janela de
antecedência e que ainda têm `reminderSentAt` nulo, emite `booking.reminder_due` e marca o campo na
mesma transação.

O caminho óbvio — enfileirar um job atrasado para T-24h no momento da confirmação — envelhece mal: a
reserva é remarcada, o job antigo continua na fila e dispara avisando o horário errado. Job atrasado
aponta para estado mutável; varredura lê o estado atual. `reminderSentAt` é a guarda de idempotência
que impede envio duplo quando duas instâncias varrem junto.

**Atenção de integração para o produto:** o `quietHours` do `notification-module` pode adiar um
lembrete para depois do compromisso. Lembrete de consulta às 08:00, com silêncio até as 08:00, chega
tarde ou não chega. Quem liga os dois precisa decidir se lembrete de agendamento respeita silêncio —
e essa decisão é do produto, não do módulo.

---

## 11. Frontend

**`SchedulingWorkspace`** composto (§4 da regra), consumido inteiro pelo produto, com `labels` e
slots de render. Áreas: agenda (dia/semana por recurso), reservas (lista com filtro e seleção),
recursos, serviços e editor de disponibilidade.

A agenda é a tela cara aqui — grade de tempo, arrastar para remarcar, sobreposição visual. É
exatamente o tipo de tela que cada produto remontaria diferente, e é o motivo de a §4 exigir o
workspace composto.

Camada headless exportada à parte (`useAvailableSlots.query.ts`, `useBooking.mutation.ts`) como
válvula de escape.

**`web-booking-widget`**: Web Component, embutível por script tag em site institucional ou aberto
por link direto. Fala com a API do produto, tipado contra o `-contracts`. Tokens de tema injetados,
sem cor própria.

---

## 12. Decisões abertas

**Q1. Reserva recorrente (série semanal) entra na v1?**
→ *Recomendação:* **não.** Série exige modelar exceção por ocorrência ("essa semana não", "a partir
de março mudou o horário"), que é a parte cara do problema — e é o que faz recorrência ser um
épico, não um campo. Sem ela, quem precisa marca as ocorrências. Entra quando um consumidor real
pedir, com spec própria.

**Q2. O módulo expõe rota pública sem autenticação para o widget?**
→ *Recomendação:* **não.** O widget fala com o **produto**, que decide autenticação, rate limit e
captcha na borda. Expor rota anônima dentro do módulo o obrigaria a carregar política de abuso, que
é do produto. O módulo continua exigindo contexto autenticado em toda rota.

**Q3. Lista de espera para horário lotado?**
→ *Recomendação:* fora da v1. É funcionalidade de valor claro, mas independente do núcleo — cabe
como evolução sem breaking change, já que `booking.cancelled` é o gatilho natural.

**Q4. O `services.priceInCents` deve existir se o módulo não cobra?**
→ *Recomendação:* **sim, e só isso.** Preço é atributo do serviço e a ponta pública precisa exibir.
Cobrança, sinal e split ficam no produto, plugados em `booking.confirmed`.

---

## 13. Critérios de aceite

- [ ] `scheduling-module` publicado com `pgSchema('scheduling')` e journal `scheduling_migrations`
- [ ] Zero `process.env` dentro dos pacotes
- [ ] Zero import de `google-calendar-provider` ou de `notification-module` dentro do módulo
- [ ] Módulo funciona inteiro sem `VideoMeetingPort` e sem `CalendarSyncPort` — nenhuma rota nem
      coluna dessas integrações exposta
- [ ] **Teste de concorrência**: duas reservas simultâneas do mesmo recurso e horário, uma falha com
      erro de domínio (não com erro cru do Postgres)
- [ ] **Teste de concorrência de reunião**: duas reuniões simultâneas compartilhando um participante
      em comum, uma falha — cobre o `booking_slots` por recurso
- [ ] **Teste de DST**: regra semanal de 09:00 continua às 09:00 locais na virada, em timezone com
      horário de verão
- [ ] Buffers respeitados: dois atendimentos colados sem buffer entre eles são recusados
- [ ] `RequestBooking` idempotente: mesma `Idempotency-Key` duas vezes devolve `200` e uma reserva
- [ ] Remarcação que falha na constraint não deixa a reserva sem slot
- [ ] Nenhuma coluna de PII no schema — auditoria automatizada, no molde do `piiAudit.test.ts`
- [ ] Teste de isolamento multiempresa por renderização de SQL
- [ ] Rotas nos dois adaptadores (`fetch` e `uws`) com teste de contrato compartilhado
- [ ] `scheduling-ui` tipando contra o `-contracts`, sem cópia local de tipo
- [ ] README com instalação, `createSchedulingModule`, portas e exemplo de host
- [ ] Revisão final com `opus` antes de publicar

---

## 14. Modelos por etapa (`model-economy.md`)

| Etapa | Modelo |
|---|---|
| Esta spec, desenho do schema e das portas | `opus` 🧠 |
| `scheduling-contracts` (tipos, zod, eventos, portas) | `sonnet` |
| Schema, migrations e repositories | `sonnet` 🧠 (a `EXCLUDE` e o GIST não são Drizzle padrão) |
| Cálculo de disponibilidade | `sonnet` 🧠 (fuso e DST) |
| Use-cases de CRUD de recurso e serviço | `sonnet` |
| Use-cases de reserva (transação, idempotência) | `sonnet` 🧠 (concorrência) |
| Rotas e adaptadores | `sonnet` |
| Worker de varredura de lembrete | `sonnet` |
| `scheduling-ui` — workspace e headless | `sonnet` |
| `web-booking-widget` | `sonnet` |
| Locales, changelogs, bumps | `haiku` |
| Revisão final | `opus` |
