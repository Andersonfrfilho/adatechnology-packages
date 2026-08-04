# @adatechnology/notification-ui

UI de notificação em React: sino com contador, inbox paginado e painel de preferências. Em duas
camadas — **headless** (hooks, sem markup) e **componentes** (o visual pronto).

## Instalação

```bash
bun add @adatechnology/notification-ui
```

Peers: `react`, `react-dom`, `@tanstack/react-query`.

## Uso

```tsx
import { NotificationProvider, NotificationBell } from '@adatechnology/notification-ui'
import '@adatechnology/notification-ui/styles.css'

<NotificationProvider client={notificationClient}>
  <NotificationBell />
</NotificationProvider>
```

Componentes: `NotificationBell`, `NotificationList`, `NotificationItem`, `PreferencesPanel`.

## A camada headless é a que importa em produto com marca

```tsx
import { useNotifications, useUnreadCount, useMarkAsRead } from '@adatechnology/notification-ui/headless'
```

Hooks sem markup nenhum: `useNotifications` (paginação infinita), `useUnreadCount`,
`useNotificationStream`, `useMarkAsRead`, `useMarkAllAsRead`, `useDeleteNotification`,
`usePreferences`, `useUpdatePreferences`.

Existe porque componente pronto quase nunca sobrevive ao design system do produto. A alternativa
usual — aceitar 20 props de estilo — vira um tema pela porta dos fundos que não atende ninguém
direito. Com os hooks, o host escreve o próprio markup e não reimplementa cache, paginação nem
reconexão de stream.

## Textos

Nada é hardcoded: `resolveMessages` recebe o dicionário do host. O default é pt-BR.

## Estado de servidor

Tudo por TanStack Query — nunca `useEffect` + `useState` para carregar da API. O stream do SSE
invalida as queries em vez de escrever no cache na mão: a origem da verdade continua sendo a API,
e a tela não diverge se um evento se perder na reconexão.

## Licença

MIT © Ada Technology
