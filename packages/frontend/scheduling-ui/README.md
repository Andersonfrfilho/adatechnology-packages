# @adatechnology/scheduling-ui

**Interface de agendamento modular** — tela com navegação por abas, dois hooks reutilizáveis e uma fábrica de componentes. Agenda, reservas, recursos, serviços e regras de disponibilidade em cinco áreas, cada uma com sua grade, filtros e ações.

- **Provider + hooks** para consumir a agenda em qualquer página do host
- **SchedulingWorkspace** — composição pronta de cinco áreas de trabalho
- **Sem fetch direto** — o host implementa `SchedulingApi`, separando a UI da lógica HTTP
- **Área controlada ou interna** — sincroniza com query string (sobrevive a refresh) ou gerencia estado localmente
- **TypeScript completo, React 18+**, com i18n português-brasileiro

---

## Instalação

```bash
bun add @adatechnology/scheduling-ui
# ou: npm install / pnpm add
```

Dependências de pares obrigatórias:

```bash
bun add react react-dom @tanstack/react-query
```

O pacote importa tipos de `@adatechnology/scheduling-contracts` automaticamente (workspace dependency).

---

## Uso básico

```tsx
import { SchedulingProvider, SchedulingWorkspace, type SchedulingApi } from '@adatechnology/scheduling-ui'

// 1. Implementar SchedulingApi no seu cliente HTTP ou module
const schedulingApi: SchedulingApi = {
  // Recursos
  async listResources(params) {
    const res = await fetch('/api/v1/scheduling/resources', { /* params */ })
    return res.json()
  },
  async createResource(input) {
    const res = await fetch('/api/v1/scheduling/resources', {
      method: 'POST',
      body: JSON.stringify(input),
    })
    return res.json()
  },
  async updateResource(id, input) {
    const res = await fetch(`/api/v1/scheduling/resources/${id}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    })
    return res.json()
  },
  async deleteResource(id) {
    await fetch(`/api/v1/scheduling/resources/${id}`, { method: 'DELETE' })
  },

  // Serviços
  async listServices(params) {
    const res = await fetch('/api/v1/scheduling/services', { /* params */ })
    return res.json()
  },
  async createService(input) {
    const res = await fetch('/api/v1/scheduling/services', {
      method: 'POST',
      body: JSON.stringify(input),
    })
    return res.json()
  },
  async updateService(id, input) {
    const res = await fetch(`/api/v1/scheduling/services/${id}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    })
    return res.json()
  },
  async deleteService(id) {
    await fetch(`/api/v1/scheduling/services/${id}`, { method: 'DELETE' })
  },

  // Regras de disponibilidade
  async listAvailabilityRules(resourceId) {
    const res = await fetch(`/api/v1/scheduling/resources/${resourceId}/availability-rules`)
    return res.json()
  },
  async setAvailabilityRules(resourceId, rules) {
    const res = await fetch(`/api/v1/scheduling/resources/${resourceId}/availability-rules`, {
      method: 'PUT',
      body: JSON.stringify(rules),
    })
    return res.json()
  },

  // Exceções de disponibilidade
  async listAvailabilityExceptions(resourceId) {
    const res = await fetch(`/api/v1/scheduling/resources/${resourceId}/availability-exceptions`)
    return res.json()
  },
  async addAvailabilityException(input) {
    const res = await fetch('/api/v1/scheduling/availability-exceptions', {
      method: 'POST',
      body: JSON.stringify(input),
    })
    return res.json()
  },
  async removeAvailabilityException(id) {
    await fetch(`/api/v1/scheduling/availability-exceptions/${id}`, { method: 'DELETE' })
  },

  // Disponibilidade de horários
  async getAvailableSlots(params) {
    const res = await fetch('/api/v1/scheduling/available-slots', { /* params */ })
    return res.json()
  },

  // Reservas
  async listBookings(params) {
    const res = await fetch('/api/v1/scheduling/bookings', { /* params */ })
    return res.json()
  },
  async getBooking(id) {
    const res = await fetch(`/api/v1/scheduling/bookings/${id}`)
    return res.json()
  },
  async requestBooking(input, idempotencyKey) {
    const res = await fetch('/api/v1/scheduling/bookings', {
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKey },
      body: JSON.stringify(input),
    })
    return res.json()
  },
  async confirmBooking(id) {
    const res = await fetch(`/api/v1/scheduling/bookings/${id}/confirm`, { method: 'POST' })
    return res.json()
  },
  async rescheduleBooking(id, input) {
    const res = await fetch(`/api/v1/scheduling/bookings/${id}/reschedule`, {
      method: 'POST',
      body: JSON.stringify(input),
    })
    return res.json()
  },
  async cancelBooking(id, input) {
    const res = await fetch(`/api/v1/scheduling/bookings/${id}/cancel`, {
      method: 'POST',
      body: JSON.stringify(input),
    })
    return res.json()
  },
  async completeBooking(id) {
    const res = await fetch(`/api/v1/scheduling/bookings/${id}/complete`, { method: 'POST' })
    return res.json()
  },
  async markNoShow(id) {
    const res = await fetch(`/api/v1/scheduling/bookings/${id}/no-show`, { method: 'POST' })
    return res.json()
  },
}

// 2. Envolver o SchedulingWorkspace com o provider
export function SchedulingPage() {
  return (
    <SchedulingProvider api={schedulingApi}>
      <SchedulingWorkspace />
    </SchedulingProvider>
  )
}
```

---

## O provider e os hooks

`SchedulingProvider` injeta a API e a configuração no contexto. Componentes internos consomem via dois hooks:

```tsx
import { useScheduling, useSchedulingConfig } from '@adatechnology/scheduling-ui'

// Dentro de <SchedulingProvider>
export function MyComponent() {
  const api = useScheduling()  // SchedulingApi
  const config = useSchedulingConfig()  // { locale, weekStartsOn }

  // Chamar métodos da API
  const bookings = await api.listBookings()

  return <div>Locale: {config.locale}</div>
}
```

Os hooks lançam erro se usados fora do provider:

```
Error: useScheduling() must be used within a <SchedulingProvider>
```

---

## SchedulingApi

Contrato que **o host implementa**. O pacote nunca faz `fetch` direto — chama os métodos que você forneceu via `SchedulingProvider`.

**Nenhum método recebe `companyId`** — o host resolve o tenant do contexto autenticado antes de implementar a API
(veja `security.md` §2, BOLA). Isso deixa o componente agnóstico sobre isolamento multi-empresa.

> **Atenção — cache do `QueryClient` na troca de tenant.** As chaves de query do pacote
> (`src/hooks/queryKeys.ts`) não carregam `companyId` — elas não têm como, já que a API não o
> recebe. Se o host reusa a mesma instância de `QueryClient` para mais de uma empresa (ex.: um
> operador trocando de tenant sem recarregar a página), dados da empresa anterior podem
> aparecer em cache até a próxima invalidação. O host deve chamar `queryClient.clear()` (ou
> `resetQueries()`) na troca de tenant, ou criar uma nova instância de `QueryClient` por sessão
> de tenant.

### Recursos

```ts
type SchedulingApi = {
  // Listar com paginação e filtros opcionais
  listResources(params?: Omit<ListResourcesParams, 'companyId'>)
    : Promise<PaginatedResponse<Resource>>

  // Criar novo recurso
  createResource(input: CreateResourceInput): Promise<Resource>

  // Atualizar
  updateResource(id: ResourceId, input: UpdateResourceInput): Promise<Resource>

  // Excluir
  deleteResource(id: ResourceId): Promise<void>
}
```

### Serviços

```ts
type SchedulingApi = {
  listServices(params?: Omit<ListServicesParams, 'companyId'>)
    : Promise<PaginatedResponse<Service>>

  createService(input: CreateServiceInput): Promise<Service>

  updateService(id: ServiceId, input: UpdateServiceInput): Promise<Service>

  deleteService(id: ServiceId): Promise<void>
}
```

### Disponibilidade (Regras e Exceções)

```ts
type SchedulingApi = {
  // Regras de horário de funcionamento por recurso
  listAvailabilityRules(resourceId: ResourceId): Promise<readonly AvailabilityRule[]>

  setAvailabilityRules(
    resourceId: ResourceId,
    rules: readonly CreateAvailabilityRuleInput[],
  ): Promise<readonly AvailabilityRule[]>

  // Exceções (feriados, bloqueios, etc)
  listAvailabilityExceptions(resourceId: ResourceId)
    : Promise<readonly AvailabilityException[]>

  addAvailabilityException(input: CreateAvailabilityExceptionInput)
    : Promise<AvailabilityException>

  removeAvailabilityException(id: AvailabilityExceptionId): Promise<void>
}
```

### Horários Disponíveis

```ts
type SchedulingApi = {
  // Buscar slots livres para um serviço/recurso/período
  getAvailableSlots(params: Omit<GetAvailabilityParams, 'companyId'>)
    : Promise<readonly AvailableSlot[]>
}
```

### Reservas

```ts
type SchedulingApi = {
  // Listar reservas do negócio
  listBookings(params?: Omit<ListBookingsParams, 'companyId'>)
    : Promise<PaginatedResponse<Booking>>

  // Buscar uma reserva
  getBooking(id: BookingId): Promise<Booking>

  // Criar reserva. ÚNICO método com idempotencyKey como segundo parâmetro
  requestBooking(input: RequestBookingInput, idempotencyKey: string): Promise<Booking>

  // Confirmar após validação
  confirmBooking(id: BookingId): Promise<Booking>

  // Remarcar
  rescheduleBooking(id: BookingId, input: RescheduleBookingInput): Promise<Booking>

  // Cancelar
  cancelBooking(id: BookingId, input: CancelBookingInput): Promise<Booking>

  // Marcar como completa
  completeBooking(id: BookingId): Promise<Booking>

  // Marcar como não-comparecimento
  markNoShow(id: BookingId): Promise<Booking>
}
```

Todos os tipos (`Resource`, `Service`, `Booking`, etc) vêm de `@adatechnology/scheduling-contracts`.

---

## SchedulingWorkspace

Componente com navegação em cinco abas e a composição pronta. Cada aba é uma área:

- **Agenda** — visualizar e buscar reservas em grade
- **Reservas** — gerenciar reservas (confirmar, remarcar, cancelar)
- **Recursos** — criar, editar e excluir recursos
- **Serviços** — criar, editar e excluir serviços
- **Disponibilidade** — definir regras e exceções por recurso

### Uso não-controlado (estado interno)

```tsx
<SchedulingProvider api={schedulingApi}>
  <SchedulingWorkspace />
</SchedulingProvider>
```

A aba ativa é guardada no estado interno do componente. Refresh ou link colado volta para a aba padrão (Agenda).

### Uso controlado (query string)

Para sincronizar a aba aberta com a URL (e sobreviver a refresh/link):

```tsx
'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { SchedulingProvider, SchedulingWorkspace, isSchedulingWorkspaceArea, SCHEDULING_WORKSPACE_AREA } from '@adatechnology/scheduling-ui'

export function SchedulingPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const areaFromUrl = searchParams.get('area')
  const area = areaFromUrl && isSchedulingWorkspaceArea(areaFromUrl) 
    ? areaFromUrl
    : SCHEDULING_WORKSPACE_AREA.AGENDA

  function handleAreaChange(nextArea: string) {
    const params = new URLSearchParams(searchParams)
    params.set('area', nextArea)
    router.push(`?${params.toString()}`)
  }

  return (
    <SchedulingProvider api={schedulingApi}>
      <SchedulingWorkspace area={area} onAreaChange={handleAreaChange} />
    </SchedulingProvider>
  )
}
```

### Props

```ts
type SchedulingWorkspaceProps = {
  // Sobrescrever rótulos de abas e títulos
  readonly labels?: Partial<SchedulingWorkspaceLabels>

  // Renderizar botões/ações no cabeçalho (ex: exportar agenda)
  readonly renderHeaderActions?: () => ReactNode

  // Aba aberta — torna o componente controlado
  readonly area?: SchedulingWorkspaceArea

  // Chamado quando o usuário clica em uma aba
  readonly onAreaChange?: (area: SchedulingWorkspaceArea) => void
}
```

Valores válidos para `area` (constante, não `enum` — projeto usa `as const` por convenção):

```ts
import { SCHEDULING_WORKSPACE_AREA } from '@adatechnology/scheduling-ui'

const SCHEDULING_WORKSPACE_AREA = {
  AGENDA: 'agenda',
  BOOKINGS: 'bookings',
  RESOURCES: 'resources',
  SERVICES: 'services',
  AVAILABILITY: 'availability',
} as const
```

Use `isSchedulingWorkspaceArea(value)` para validar strings da URL:

```ts
const area = searchParams.get('area')
if (isSchedulingWorkspaceArea(area)) {
  // TypeScript agora sabe que `area` é válido
}
```

---

## Configuração

`SchedulingProvider` aceita uma configuração parcial (`config`), que mescla com os padrões:

```tsx
<SchedulingProvider
  api={schedulingApi}
  config={{
    locale: 'pt-BR',      // padrão
    weekStartsOn: 1,      // 0 = domingo, 1 = segunda-feira (padrão)
  }}
>
  <SchedulingWorkspace />
</SchedulingProvider>
```

- **`locale`** — identifica o idioma; usado em i18n dentro do componente. Padrão: `'pt-BR'`.
- **`weekStartsOn`** — primeiro dia da semana na grade de agenda (0 = domingo, 1 = segunda). Padrão: `1`.

---

## Licença

MIT © Ada Technology
