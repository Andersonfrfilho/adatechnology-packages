# @adatechnology/scheduling-contracts

**Tipos, schemas e contratos de porta** para o módulo de agendamento.
TypeScript, sem dependências de runtime (só Zod para validação em boundaries).

- **Tipos de domínio** — `Resource`, `Service`, `Booking`, `AvailabilityRule`, `AvailabilityException`
- **Schemas Zod** — validação de entrada para todo endpoint e worker
- **Interfaces de porta** — contratos de inversão que o host implementa (`VideoMeetingPort`, `CalendarSyncPort`, etc)
- **Eventos e hooks** — sete eventos de ciclo de vida, com hooks opcionais para regra comercial

Pacote-irmão do `scheduling-module` (a implementação); consumido também pelo host (API, BFF, worker).

---

## Instalação

```bash
npm i @adatechnology/scheduling-contracts
# ou: pnpm add / bun add
```

Nenhuma dependência de runtime além de `zod`.

---

## O que este pacote exporta

### Tipos de domínio

Toda entidade de agendamento tem seu tipo TypeScript correspondente:

```ts
import type {
  Resource,
  Service,
  Booking,
  BookingSlot,
  AvailabilityRule,
  AvailabilityException,
} from '@adatechnology/scheduling-contracts'
```

Enums são constantes (`as const`): `RESOURCE_KIND`, `BOOKING_STATUS`, `BOOKING_PARTICIPANT_RESPONSE_STATUS`, etc.

### Schemas de validação

Zod schemas para toda entrada (body, query, path, eventos):

```ts
import {
  createResourceSchema,
  updateResourceSchema,
  requestBookingSchema,
  rescheduleBookingSchema,
  cancelBookingSchema,
  listBookingsQuerySchema,
  getAvailabilityQuerySchema,
} from '@adatechnology/scheduling-contracts'

// Validar entrada de API
const input = createResourceSchema.parse(req.body)
```

---

## Portas (interfaces de integração)

Portas são contratos que o **host implementa** — o módulo não conhece a implementação concreta,
só chama pelo contrato. Ausência de uma porta = capacidade desligada (não é erro, é opção).

### `AuthContextResolverPort`

Resolve identidade do usuário a partir de headers HTTP:

```ts
import type { AuthContextResolverPort } from '@adatechnology/scheduling-contracts'

const resolver: AuthContextResolverPort = {
  async resolve({ headers }) {
    // Validação de token, JWT, sessão — já feita fora
    // Retorna contexto ou undefined (não autenticado)
    return {
      companyId: '...',
      userId: '...',
      scopes: ['scheduling:read', 'scheduling:write'],
    }
  },
}
```

`AuthContext` já vem **validado pelo host** — o módulo não verifica token nem descobre o emissor.
Vem apenas `companyId` (obrigatório) e `userId` (opcional para máquina-a-máquina).

### `VideoMeetingPort`

Criar/deletar links de reunião (Zoom, Google Meet, etc):

```ts
import type { VideoMeetingPort } from '@adatechnology/scheduling-contracts'

const videoMeeting: VideoMeetingPort = {
  async createMeeting({ bookingId, title, startsAt, endsAt }) {
    // Chamar Zoom, Google Calendar, etc
    // Retorna meetingUrl ou erro
    return {
      outcome: 'created',
      meetingUrl: 'https://zoom.us/j/...',
    }
  },
  
  async deleteMeeting(meetingUrl) {
    // Remover a reunião
  },
}
```

**Ausente = presencial.** Se você não injetar `VideoMeetingPort`, o módulo não cria link.
Falha ao criar link **não bloqueia** a confirmação de reserva — o módulo loga e segue.

### `CalendarSyncPort`

Espelho unidirecional (push) em Google Calendar, Outlook, etc:

```ts
import type { CalendarSyncPort } from '@adatechnology/scheduling-contracts'

const calendarSync: CalendarSyncPort = {
  async upsertEvent({ externalCalendarId, title, startsAt, endsAt, notes }) {
    // Criar ou atualizar evento no calendário externo
    return {
      outcome: 'synced',
      externalEventId: 'event-123',
    }
  },
  
  async deleteEvent(externalEventId) {
    // Remover evento do calendário externo
  },
  
  async readEvents({ from, until }) {
    // Listar eventos no intervalo (implementado na v2)
    // Por enquanto retorna array vazio
    return []
  },
}
```

**Push-only na v1** — sem webhook do fornecedor, sem sync bidirecional, sem resolução de conflito.
`readEvents` já vem declarado (sem implementação) para não virar breaking change depois.

**Ausente = sem espelho.** Config `calendarSync.enabled: true` sem porta plugada = erro no boot (`CalendarSyncDisabledError`).

### `ClockPort`

Relógio injetável (para teste, para lidar com clock skew):

```ts
import type { ClockPort } from '@adatechnology/scheduling-contracts'

const clock: ClockPort = {
  now() {
    return new Date()
  },
}
```

### `LoggerPort`

Logger estruturado (máscara de PII obrigatória):

```ts
import type { LoggerPort } from '@adatechnology/scheduling-contracts'

const logger: LoggerPort = {
  debug(message, meta) { /* ... */ },
  info(message, meta) { /* ... */ },
  warn(message, meta) { /* ... */ },
  error(message, meta) { /* ... */ },
}
```

---

## Configuração do módulo

`SchedulingModuleConfig` agrupa opções de negócio e capacidade:

```ts
import type { SchedulingModuleConfig } from '@adatechnology/scheduling-contracts'

const config: SchedulingModuleConfig = {
  // Teto de dias consultáveis numa janela de disponibilidade
  maxLookaheadDays: 90,
  
  // Prazo mínimo para cancelamento (em minutos), 0 = desliga
  defaultMinCancellationNoticeMinutes: 1440, // 24h
  
  // Tolerância para "horário no passado" em criação/remarcação
  pastBookingToleranceMinutes: 0,
  
  // Janela de antecedência para lembrete (padrão 1440 = 24h)
  reminderAdvanceMinutes: 1440,
  
  // Ligar espelho em calendário externo
  calendarSync: {
    enabled: true,
  },
}
```

---

## Eventos e hooks

O módulo dispara sete eventos ao longo do ciclo de vida de uma reserva.
**Hooks são opcionais** — você só implementa o que precisa.

### Hooks são void-tolerantes

Se um hook lançar erro, o módulo **captura, loga e segue**. Regra comercial (notificar por WhatsApp,
gravar em CRM, multa por no-show) nunca vira `if` dentro do agendamento — sempre um hook plugado aqui.

```ts
import type { SchedulingHooks } from '@adatechnology/scheduling-contracts'

const hooks: SchedulingHooks = {
  async onBookingRequested(event) {
    // Reserva foi solicitada (ainda não confirmada)
    // Integrar com CRM, notificar, aplicar política de sinal
  },
  
  async onBookingConfirmed(event) {
    // Reserva foi confirmada
    // Notificar cliente, criar tarefa, registrar contato
  },
  
  async onBookingRescheduled(event) {
    // Reserva foi remarcada (event.previousDuring tem a faixa anterior)
    // Notificar: "mudou de X para Y"
  },
  
  async onBookingCancelled(event) {
    // Reserva foi cancelada (event.cancelledBy é quem pediu)
    // Notificar, reembolsar, aplicar multa por no-show
  },
  
  async onBookingReminderDue(event) {
    // Reminder foi disparado (geralmente 24h antes)
    // Enviar SMS, WhatsApp, notificação push
  },
  
  async onBookingCompleted(event) {
    // Reserva transcorreu (passou a hora)
    // Registrar no histórico, liberar para feedback
  },
  
  async onBookingNoShow(event) {
    // Cliente não compareceu
    // Multa, entrada em blacklist, CRM updated
  },
}
```

Cada hook recebe evento tipado com metadados — `companyId`, `bookingId`, `resourceIds`, `serviceId` (quando houver).

---

## Erros

Toda operação falha com uma das erros especializados:

```ts
import {
  SchedulingError,
  SCHEDULING_ERROR_CODES,
  ResourceNotFoundError,
  ServiceNotFoundError,
  AvailabilityExceptionNotFoundError,
  BookingNotFoundError,
  SlotUnavailableError,
  CancellationTooLateError,
  BookingInPastError,
  ResourceUnavailableError,
  ServiceNotOfferedByResourceError,
  ConfigMissingError,
  LookaheadWindowTooLargeError,
  CalendarSyncDisabledError,
} from '@adatechnology/scheduling-contracts'
```

Cada erro estende `SchedulingError` e carrega:
- `statusCode` — HTTP apropriado (404, 409, 400, 500)
- `code` — chave estável para tratamento na UI (`SCHEDULING_SLOT_UNAVAILABLE`, etc)
- `details` — contexto tipado (ex: `{ resourceId, during }`)

| Erro | Causa | Status |
|---|---|---|
| `ResourceNotFoundError` | Recurso não existe ou foi deletado | 404 |
| `ServiceNotFoundError` | Serviço não existe | 404 |
| `AvailabilityExceptionNotFoundError` | Exceção de disponibilidade não existe | 404 |
| `BookingNotFoundError` | Reserva não existe | 404 |
| `SlotUnavailableError` | Horário já foi ocupado por outra reserva (constraint `booking_slot_no_overlap`) | 409 |
| `CancellationTooLateError` | Prazo mínimo de cancelamento passou | 409 |
| `BookingInPastError` | Tentou agendar/remarcar para o passado | 400 |
| `ResourceUnavailableError` | Recurso inativo, deletado ou fora da janela de validade | 409 |
| `ServiceNotOfferedByResourceError` | Este recurso não oferece este serviço | 400 |
| `ConfigMissingError` | Campo obrigatório da config falta no boot | 500 |
| `LookaheadWindowTooLargeError` | Consultou mais dias que `maxLookaheadDays` | 400 |
| `CalendarSyncDisabledError` | Config habilitou sync mas porta não foi plugada | 409 |

---

## Utilitários exportados

| Tipo | Uso |
|---|---|
| Tipos de domínio | `Resource`, `Service`, `Booking`, `AvailabilityRule`, `AvailabilityException`, `BookingSlot`, `BookingParticipant` |
| Schemas Zod | `createResourceSchema`, `requestBookingSchema`, `listBookingsQuerySchema`, `getAvailabilityQuerySchema`, etc |
| Portas | `AuthContextResolverPort`, `VideoMeetingPort`, `CalendarSyncPort`, `ClockPort`, `LoggerPort` |
| Tipos de porta | `AuthContext`, `VideoMeetingRequest`, `CalendarEventPayload`, `LogMeta`, `SchedulingModuleConfig` |
| Eventos | `SCHEDULING_EVENT` (constantes), `SchedulingHooks`, `BookingRequestedEvent`, `BookingConfirmedEvent`, etc |
| Erros | `SchedulingError`, `SCHEDULING_ERROR_CODES`, 12 erros especializados |

---

## Pré-requisitos

- **TypeScript 5.0+**
- **Zod 3.x** — importado automaticamente em schemas
- **Conhecimento de portas/inversão de controle** — o pacote é contrato puro

---

## Como consumir em `scheduling-module`

O módulo é uma função fábrica que injeta portas e hooks — não uma classe:

```ts
import { createSchedulingModule } from '@adatechnology/scheduling-module'
import type { SchedulingModuleConfig } from '@adatechnology/scheduling-contracts'

const scheduling = createSchedulingModule({
  db,
  config,
  providers: {
    clock,
    logger,
    videoMeeting, // opcional
    calendarSync, // opcional
  },
  hooks, // opcional
})
```

Quando uma porta está ausente, a capacidade é desligada — sem flag, sem null check em callback.

---

## Licença

MIT © Ada Technology
