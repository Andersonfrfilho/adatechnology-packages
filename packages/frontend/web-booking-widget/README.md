# @adatechnology/web-booking-widget

Agendamento de serviço como Web Component nativo (`<ada-booking-widget>`), sem framework —
plugável em qualquer página, no molde do `@adatechnology/web-chat-widget`.

## Uso

```html
<script type="module">
  import '@adatechnology/web-booking-widget'
</script>

<ada-booking-widget
  api-base="https://sua-api.com"
  theme='{"primaryColor":"#0f766e","primaryContrastColor":"#ffffff"}'
></ada-booking-widget>
```

- `api-base` (obrigatório): origem da API do **produto hospedeiro**. O widget lança erro no
  `connectedCallback` se o atributo faltar — nunca assume uma origem padrão.
- `theme` (opcional): JSON com tokens de cor/raio. Sem o atributo, o widget usa um fallback
  neutro (cinza/preto) — ele não carrega cor de marca própria (ver `widget.style.ts`).

### Tokens de tema aceitos

| Token | Variável CSS |
|---|---|
| `primaryColor` | `--ada-booking-primary` |
| `primaryContrastColor` | `--ada-booking-primary-contrast` |
| `surfaceColor` | `--ada-booking-surface` |
| `backgroundColor` | `--ada-booking-bg` |
| `textColor` | `--ada-booking-text` |
| `mutedColor` | `--ada-booking-muted` |
| `borderColor` | `--ada-booking-border` |
| `radius` | `--ada-booking-radius` |

Chave desconhecida ou JSON inválido é ignorado silenciosamente — o restante do tema aplica normal.

## O contrato HTTP que o host precisa servir

O widget **nunca fala com `@adatechnology/scheduling-module` diretamente** — só com rotas da
API do produto, que decide autenticação, rate limit e captcha na borda (spec do
`scheduling-trio`, decisão Q2). O host implementa as quatro rotas abaixo, delegando para o
módulo por trás da própria API:

| Rota | Método | Descrição |
|---|---|---|
| `/v1/booking-widget/services` | `GET` | Lista serviços agendáveis |
| `/v1/booking-widget/resources?serviceId=` | `GET` | Lista profissionais/recursos do serviço |
| `/v1/booking-widget/availability?serviceId=&resourceId=&from=&to=` | `GET` | Lista horários livres na janela |
| `/v1/booking-widget/bookings` | `POST` | Cria o agendamento |

Toda resposta segue o envelope padrão (`apis.md`): sucesso `{ data }`, erro
`{ error: { code, message } }`.

### `GET /v1/booking-widget/services`

```json
{ "data": [{ "id": "svc_1", "name": "Corte", "description": null, "durationMinutes": 30, "priceInCents": 5000 }] }
```

### `GET /v1/booking-widget/resources`

```json
{ "data": [{ "id": "res_1", "name": "Ana", "timezone": "America/Manaus" }] }
```

`timezone` é o fuso IANA do recurso (não da empresa) — ver `Resource.timezone` em
`scheduling-contracts`. É o que permite ao widget mostrar o horário do profissional ao lado do
horário do visitante quando os fusos divergem.

### `GET /v1/booking-widget/availability`

```json
{ "data": [{ "resourceId": "res_1", "startsAt": "2026-08-20T14:00:00Z", "endsAt": "2026-08-20T14:30:00Z" }] }
```

### `POST /v1/booking-widget/bookings`

Corpo:

```json
{
  "serviceId": "svc_1",
  "resourceId": "res_1",
  "startsAt": "2026-08-20T14:00:00Z",
  "endsAt": "2026-08-20T14:30:00Z",
  "customerName": "Maria",
  "customerContact": "maria@example.com"
}
```

Resposta:

```json
{ "data": { "bookingId": "bkg_1", "status": "confirmed" } }
```

## Fuso horário

O widget mostra os horários de disponibilidade no fuso do **visitante**
(`Intl.DateTimeFormat().resolvedOptions().timeZone`), não no fuso do recurso — evita o erro
clássico de o cliente ler "14:00" no próprio horário e o profissional estar num fuso diferente.
Quando os fusos divergem, o fuso do recurso aparece como nota secundária ao lado do horário.

## Ainda não parametrizado

- Locale fixo em pt-BR (`widget.locale.json`), sem suporte a outro idioma ainda.
- Sem paginação na listagem de disponibilidade — a janela é fixa em
  `AVAILABILITY_WINDOW_DAYS` (14 dias).
