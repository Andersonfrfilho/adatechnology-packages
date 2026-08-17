# @adatechnology/scheduling-module

**Agendamento de serviços e recursos** como módulo plugável: CRUD de recursos/serviços, grades de
disponibilidade com exceções, reservas com remarcação, confirmação e lembretes por cron.
TypeScript, Drizzle + PostgreSQL, roda em Bun e Node.

- Tabelas em `pgSchema('scheduling')`, com migrations e journal próprios — nunca toca o `public` do host
- Rotas HTTP prontas para `Bun.serve` **e** uWebSockets.js, com paridade testada entre os dois
- Sobreposição de horários bloqueada por constraint `EXCLUDE` do PostgreSQL (requer extensão `btree_gist`)
- Multiempresa por construção, com teste de isolamento por renderização de SQL
- Lembretes por cron, não por fila — o host registra os descriptores no seu agendador
- Vídeo e sincronização de calendário são capacidades **opcionais e injetadas por porta**, desligadas por padrão

## Instalação

```bash
bun add @adatechnology/scheduling-module @adatechnology/scheduling-contracts
```

`drizzle-orm` é peer dependency. Para montar as rotas, adicione também `@adatechnology/module-http`.

## Uso mínimo

```ts
import { createSchedulingModule, runSchedulingMigrations } from '@adatechnology/scheduling-module'
import { migrate } from 'drizzle-orm/node-postgres/migrator'

// Executar migrations — obrigatório antes de usar qualquer use-case
await runSchedulingMigrations({ db, migrate })

const scheduling = createSchedulingModule({
  db,                                    // conexão do host — o módulo não abre nenhuma
  config: {
    maxLookaheadDays: 90,                // teto de dias consultáveis na disponibilidade
    reminderAdvanceMinutes: 1440,        // 24h antes do agendamento (padrão)
  },
})

// Criar um recurso (ex: sala de reunião)
const resource = await scheduling.useCases.createResource.execute({
  companyId,                             // vem SEMPRE do contexto autenticado do host
  input: {
    kind: 'room',
    name: 'Sala A',
    timeZone: 'America/Sao_Paulo',
  },
})

// Criar um serviço (ex: consulta médica de 30 min)
const service = await scheduling.useCases.createService.execute({
  companyId,
  input: {
    name: 'Consulta',
    durationMinutes: 30,
  },
})
```

`companyId` vem sempre do contexto autenticado do host, nunca do corpo da requisição.

## Rotas prontas

```ts
import { createSchedulingRoutes } from '@adatechnology/scheduling-module'
import { createModuleFetchRouter } from '@adatechnology/module-http/fetch'

const http = createModuleFetchRouter({
  routes: createSchedulingRoutes({ module: scheduling }),
  basePath: '/v1',
  authResolver,          // devolve { companyId, userId, scopes } JÁ validado pelo host
})

// no router do host, antes do 404:
if (http.match(request)) return http.handle(request)
```

Para uWebSockets, troque por `mountModuleRoutes` de `@adatechnology/module-http/uws` — as duas
rotas passam pelo mesmo despachante, e há teste de paridade garantindo respostas idênticas.

| Recurso | Rotas |
|---|---|
| Recursos | `GET/POST /resources`, `GET/PUT/DELETE /resources/:id` |
| Serviços | `GET/POST /services`, `GET/PUT/DELETE /services/:id`, `PUT/DELETE /services/:id/resources/:resourceId` |
| Disponibilidade | `GET /availability`, `GET/PUT /resources/:id/availability-rules`, `GET/POST /resources/:id/availability-exceptions`, `DELETE /availability-exceptions/:id` |
| Reservas | `GET/POST /bookings`, `GET /bookings/:id`, `POST /bookings/:id/confirm`, `PUT /bookings/:id/reschedule`, `POST /bookings/:id/cancel`, `POST /bookings/:id/complete`, `POST /bookings/:id/no-show`, `POST /bookings/:id/sync-calendar` (opcional) |

Paths OpenAPI saem da mesma tabela:

```ts
import { schedulingOpenApiPaths } from '@adatechnology/scheduling-module/openapi'
const spec = buildOpenApiSpec({ extraPaths: schedulingOpenApiPaths({ routes, basePath: '/v1' }) })
```

## Disponibilidade

A grade semanal de um recurso é definida uma vez por `setAvailabilityRules` e listada com
`listAvailabilityRules`. Exceções pontuais (plantão, manutenção, encaixe de emergência) entram por
`addAvailabilityException` com tipo `blocked` ou `available`.

```ts
const slots = await scheduling.useCases.listAvailableSlots.execute({
  companyId,
  resourceId: roomId,
  serviceId: consultationId,
  from: startDate,
  until: endDate,
})
// [{ startsAt, endsAt, isAvailable }, ...]
```

Horários que **não podem se sobrepor** em nenhum caso — confirmadas, pendentes ou em andamento —
são bloqueados por constraint `EXCLUDE` no banco, sem checagem em application.

## Reservas

Uma reserva nasce em estado `pending` por `requestBooking` (com `Idempotency-Key` opcional) e
transita por `confirmed` → `completed` ou `cancelled`/`no_show`. Remarcação acontece antes da
confirmação — o fluxo normal é: request → reschedule → confirm → complete.

```ts
const booking = await scheduling.useCases.requestBooking.execute({
  companyId,
  input: {
    serviceId: consultationId,
    resourceIds: [roomId],
    during: { startsAt, endsAt },
    customerRef: 'cliente_123',
  },
})
```

Cancelamento rejeita se faltam minutos de antecedência (config `defaultMinCancellationNoticeMinutes`);
`0` desliga essa validação.

## Vídeo e reunião remota

Se o host tem integração com Zoom/Google Meet, plugue a porta:

```ts
const scheduling = createSchedulingModule({
  db,
  config: { maxLookaheadDays: 90 },
  providers: {
    videoMeeting: zoomAdapter,  // implementa VideoMeetingPort
  },
})

// O módulo auto-detecta:
console.log(scheduling.hasVideoMeeting)  // true
```

Link é criado no `confirmBooking` e deletado no `cancelBooking`. Falha de vídeo **não bloqueia**
a reserva — é capacidade pura (log + rollback).

Sem provider, `hasVideoMeeting` é `false` e nenhuma affordance de vídeo entra nas respostas.

## Sincronização com calendário externo

Sincronização **one-way (push)** em Google Calendar ou Outlook por `calendarSync`:

```ts
const scheduling = createSchedulingModule({
  db,
  config: {
    maxLookaheadDays: 90,
    calendarSync: { enabled: true },
  },
  providers: {
    calendarSync: googleCalendarAdapter,  // implementa CalendarSyncPort
  },
})
```

**Importante:** ligar `calendarSync.enabled` sem plugar a porta **falha no boot** com
`CalendarSyncDisabledError()`, nunca na primeira tentativa de sincronizar. Isso evita surpresas em produção.

Rota `POST /bookings/:id/sync-calendar` só aparece quando `module.hasCalendarSync` é true.

## Lembretes

Não há fila de lembretes. O módulo registra um descriptor de cron que o **host** integra no seu agendador:

```ts
import { createSchedulingSchedules } from '@adatechnology/scheduling-module'

const schedules = createSchedulingSchedules(scheduling)

for (const schedule of schedules) {
  cron.register(schedule.name, schedule.cronExpression, () => schedule.run())
}
```

`SweepDueReminders` lê a cada minuto (por padrão `* * * * *`) todas as reservas confirmadas cuja
data de início cai dentro da janela `reminderAdvanceMinutes` (padrão 24h). Para cada uma, dispara
o hook `onBookingReminderDue`. O módulo marca `reminderSentAt` para não reenviar.

**Não há fila, e é decisão.** A varredura lê `reminderSentAt` fresco a cada execução; duas
instâncias do cron rodando ao mesmo tempo usam `FOR UPDATE SKIP LOCKED` para nunca emitir o mesmo
lembrete duas vezes. Isso evita exigir broker de mensagens para uma capacidade que é só "notificar
quando a hora chegou", sem retry por canal ou qualquer complexidade de entrega.

## Extensão de comportamento

O host pluga hooks para regras comerciais (política de no-show, sinal/depósito, comissão):

```ts
const scheduling = createSchedulingModule({
  db,
  config: { maxLookaheadDays: 90 },
  hooks: {
    onBookingRequested: async (event) => {
      // event.companyId, event.bookingId, event.serviceId, event.resourceIds, event.status
      // Ex: validar crédito, bloquear cliente, enviar welcome
    },
    onBookingConfirmed: async (event) => {
      // Ex: gerar link de vídeo (já feito pelo módulo se VideoMeetingPort plugado)
      // Ex: enviar confirmação SMS
    },
    onBookingReminderDue: async (event) => {
      // Ex: enviar WhatsApp de lembrete
      // event.during, event.customerRef, event.organizerRef
    },
    onBookingCancelled: async (event) => {
      // event.cancelledBy, event.cancellationReason
      // Ex: devolver sinal se foi cobrado
    },
    onBookingNoShow: async (event) => {
      // Ex: cobrar multa, atualizar reputação
    },
    // ... onBookingRescheduled, onBookingCompleted
  },
})
```

Hooks são **void-tolerantes**: exceção num hook é logada e ignora, não derruba a operação. Use
para efeitos colaterais — faturamento, notificação — nunca para regras que afetam o estado da
reserva.

## Pré-requisito de infraestrutura

A extensão **`btree_gist`** do PostgreSQL **precisa estar disponível** — é usada para a constraint
`EXCLUDE` que bloqueia sobreposição de horários. Instale uma vez no cluster:

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;
```

A primeira migration de `runSchedulingMigrations` tenta instalar; se falhar por
falta de permissão (PostgreSQL gerenciado com allowlist de extensão), a migration não roda. Configure a
extensão no banco **antes** de subir a app.

## Licença

MIT © Ada Technology
