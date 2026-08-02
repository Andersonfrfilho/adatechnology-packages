# CLAUDE.md — @adatechnology/notification-ui

## Propósito

Telas de notificação (sino, inbox, preferências) com **camada headless exportada separada**.
Consome o `@adatechnology/notification-client` e o `QueryClient` **do host**.

Spec: `.specs/features/notification-trio/spec.md` (Fase 6).

## Dois entrypoints, e a diferença importa

| Import | Traz | Para quem |
|---|---|---|
| `@adatechnology/notification-ui/headless` | provider + hooks | produto que monta a própria tela |
| `@adatechnology/notification-ui` | tudo acima + componentes + `lucide-react` | quem quer a tela pronta |

Quem importa só `/headless` não carrega componente, CSS nem biblioteca de ícones — é a válvula de
escape do item 4 da §4 da regra de módulos plugáveis, e ela só vale se estiver separada de fato.

## Nunca instancia QueryClient

O `NotificationProvider` usa o do host. Instanciar o próprio criaria **dois caches na mesma
página**: a inbox invalidaria um e a tela do produto continuaria lendo o outro.

`NOTIFICATION_QUERY_KEYS` centraliza as chaves porque o sino e a lista leem o mesmo
`unreadCount` — chave montada inline em cada hook é exatamente como badge e lista passam a
mostrar números diferentes.

## Uso

```tsx
import { NotificationProvider, NotificationBell, NotificationList } from '@adatechnology/notification-ui'
import '@adatechnology/notification-ui/styles.css'

<NotificationProvider client={notificationClient} locale="pt-BR" theme={{ rootClassName: 'meu-tema' }}>
  <NotificationBell onClick={abrirPainel} />
  <NotificationList onSelect={(n) => navegar(n)} />
</NotificationProvider>
```

SSE é opt-in — abrir conexão é decisão do host, que sabe se o backend expõe a rota:

```tsx
useNotificationStream({ enabled: true })
```

## Tema sem cor própria

`styles.css` só usa `var(--adn-*, fallback)`. O host sobrescreve as custom properties no escopo
dele e a mesma tela ganha a cara do produto. Há teste garantindo que nenhum hexadecimal de marca
entrou no CSS (`components/accessibility.test.ts`).

## Ícones seguem a regra do ecossistema

`web.md` §9: `lucide-react`, nunca emoji; ícone que acompanha rótulo é `aria-hidden`; botão
só-ícone tem `aria-label`; tamanho e cor vêm do CSS via `currentColor`, não de prop no JSX. Os
quatro pontos são verificados por teste que inspeciona o fonte dos componentes.

## Slots

```tsx
<NotificationList components={{ Item: MinhaLinhaCustomizada }} />
```

## Comandos

```bash
pnpm --filter @adatechnology/notification-ui run check   # tsc --noEmit
pnpm --filter @adatechnology/notification-ui run test    # bun test
pnpm --filter @adatechnology/notification-ui run build   # tsup (esm + dts + css)
```
