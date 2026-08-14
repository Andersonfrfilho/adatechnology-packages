# @adatechnology/scheduling-module

**Agendamento de serviço e reunião** como módulo plugável: recursos, serviços, disponibilidade,
reservas e lembretes. TypeScript, Drizzle + PostgreSQL, roda em Bun e Node.

- Tabelas em `pgSchema('scheduling')`, com migrations e journal próprios — nunca toca o `public` do host
- Conflito de horário protegido por `EXCLUDE USING gist` no Postgres, nunca checado em memória
- Rotas HTTP prontas para `Bun.serve` **e** uWebSockets.js, com paridade testada entre os dois
- Multiempresa por construção — recurso de outra empresa devolve 404, nunca 403
- Vídeo (`VideoMeetingPort`) e espelho de calendário externo (`CalendarSyncPort`) são capacidades
  opcionais por ausência: sem provider plugado, o affordance nem existe na tabela de rotas

## Instalação

```bash
bun add @adatechnology/scheduling-module @adatechnology/scheduling-contracts
```

`drizzle-orm` é peer dependency. Para montar as rotas, adicione também `@adatechnology/module-http`.

## Uso mínimo

```ts
import { createSchedulingModule, runSchedulingMigrations } from '@adatechnology/scheduling-module'
import { migrate } from 'drizzle-orm/node-postgres/migrator'

await runSchedulingMigrations({ db, migrate })

const scheduling = createSchedulingModule({
  db,                                   // conexão do host — o módulo não abre nenhuma
  config: { maxLookaheadDays: 60 },
})

const { booking } = await scheduling.useCases.requestBooking.execute({
  companyId,
  input: {
    title: 'Corte de cabelo',
    resourceIds: [resourceId],          // 1 item = serviço; 2+ = reunião (spec §2)
    during: { start, end },
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

Paths OpenAPI saem da mesma tabela:

```ts
import { schedulingOpenApiPaths } from '@adatechnology/scheduling-module'
const spec = buildOpenApiSpec({ extraPaths: schedulingOpenApiPaths({ routes, basePath: '/v1' }) })
```

## Lembretes

`SweepDueReminders` é **varredura, não job atrasado** (spec §10): enfileirar um lembrete com atraso
fixo no momento da confirmação quebraria se a reserva fosse remarcada depois — o job ficaria
apontando para o horário antigo. Em vez disso, cada varredura lê o estado atual do banco.

```ts
import { createSchedulingSchedules } from '@adatechnology/scheduling-module'

for (const schedule of createSchedulingSchedules(scheduling)) {
  cron.register(schedule.name, schedule.cronExpression, schedule.run)
}
```

**Não há fila, e é decisão.** Diferente de uma entrega de notificação (que precisa de retry por
canal e se beneficia de uma fila de verdade), o lembrete de agendamento só precisa emitir um evento
de domínio — `reminderSentAt` já é o guarda de idempotência, marcado atomicamente
(`FOR UPDATE SKIP LOCKED`) na mesma transação que reivindica as reservas devidas, então duas
instâncias do cron rodando ao mesmo tempo nunca emitem o mesmo lembrete duas vezes. Por isso
`createSchedulingSchedules` recebe só o módulo (que já carrega `db`) — não existe `QueuePort` nos
providers de agendamento, e não é omissão: é o mesmo raciocínio da sincronização com a Meta em
`catalog-module` ("não há fila, e é decisão").

```ts
scheduling.hooks.onBookingReminderDue = async (event) => {
  await notifications.useCases.sendNotification.execute({
    companyId: event.companyId,
    // event.customerRef / event.organizerRef são referências opacas — o produto resolve telefone,
    // e-mail ou push a partir delas; o módulo de agendamento nunca guarda esse dado.
  })
}
```

### Armadilha do `quietHours`

Se o host aciona `notification-module` a partir de `onBookingReminderDue`, a política de
`quietHours` daquele módulo pode **adiar o envio para depois do horário do compromisso** — o
lembrete de uma reserva às 8h chega às 9h se a janela silenciosa ia até as 8h30. O agendamento não
sabe disso: ele só emite o evento no momento certo.

Decidir se o lembrete de agendamento **respeita** `quietHours` é do produto que liga os dois
módulos, nunca deste pacote — um lembrete de compromisso não é a mesma categoria de mensagem que
uma notificação de marketing, e o produto é quem sabe se prefere furar a janela silenciosa ou
aceitar o atraso.

## Licença

MIT © Ada Technology
