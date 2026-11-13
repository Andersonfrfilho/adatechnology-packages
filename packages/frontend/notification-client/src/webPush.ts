/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Helpers isomórficos para Web Push nativo (W3C Push API) em PWAs.
 * Não depende de Firebase nem de bibliotecas externas: funciona nativamente no Chrome,
 * Firefox, Edge e Safari (iOS 16.4+ e macOS).
 */

import type { WebPushSubscription } from '@adatechnology/notification-contracts'

export type SubscribeWebPushOptions = {
  readonly vapidPublicKey: string
  readonly serviceWorkerRegistration?: ServiceWorkerRegistration
}

/**
 * Converte chave pública VAPID em base64url para Uint8Array.
 * Exigido pelo navegador em `pushManager.subscribe({ applicationServerKey })`.
 */
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const outputArray = new Uint8Array(rawData.length)

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

export function arrayBufferToBase64Url(buffer: ArrayBufferLike | ArrayBuffer | null): string {
  if (!buffer) return ''
  const bytes = new Uint8Array(buffer as ArrayBuffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * Verifica se o ambiente de execução suporta Web Push nativo via Service Worker.
 */
export function isWebPushSupported(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

/**
 * Inscreve o navegador no Push Service nativo usando as chaves VAPID fornecidas.
 * Retorna `undefined` caso a permissão seja negada pelo usuário (caminho normal, sem lançar erro).
 */
export async function subscribeWebPush(options: SubscribeWebPushOptions): Promise<WebPushSubscription | undefined> {
  if (!isWebPushSupported()) return undefined

  if (Notification.permission === 'default') {
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return undefined
  } else if (Notification.permission !== 'granted') {
    return undefined
  }

  const registration = options.serviceWorkerRegistration ?? (await navigator.serviceWorker.ready)
  const applicationServerKey = urlBase64ToUint8Array(options.vapidPublicKey)

  let subscription = await registration.pushManager.getSubscription()
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: applicationServerKey as unknown as BufferSource,
    })
  }

  const p256dh = arrayBufferToBase64Url(subscription.getKey('p256dh'))
  const auth = arrayBufferToBase64Url(subscription.getKey('auth'))

  return {
    endpoint: subscription.endpoint,
    keys: { p256dh, auth },
    expirationTime: subscription.expirationTime,
  }
}

/**
 * Remove a inscrição ativa de push no navegador.
 */
export async function unsubscribeWebPush(serviceWorkerRegistration?: ServiceWorkerRegistration): Promise<boolean> {
  if (!isWebPushSupported()) return false

  const registration = serviceWorkerRegistration ?? (await navigator.serviceWorker.ready)
  const subscription = await registration.pushManager.getSubscription()
  if (!subscription) return false

  return subscription.unsubscribe()
}

/**
 * Obtém a inscrição ativa de push no navegador se já existir.
 */
export async function getWebPushSubscription(
  serviceWorkerRegistration?: ServiceWorkerRegistration,
): Promise<WebPushSubscription | undefined> {
  if (!isWebPushSupported()) return undefined

  const registration = serviceWorkerRegistration ?? (await navigator.serviceWorker.ready)
  const subscription = await registration.pushManager.getSubscription()
  if (!subscription) return undefined

  const p256dh = arrayBufferToBase64Url(subscription.getKey('p256dh'))
  const auth = arrayBufferToBase64Url(subscription.getKey('auth'))

  return {
    endpoint: subscription.endpoint,
    keys: { p256dh, auth },
    expirationTime: subscription.expirationTime,
  }
}

/**
 * Retorna o script padrão do Service Worker para manipulação de notificações em PWAs.
 */
export function getStandardWebPushServiceWorkerScript(): string {
  return `
self.addEventListener('push', (event) => {
  if (!event.data) return;
  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: 'Notificação', body: event.data.text() };
  }

  const title = payload.title || 'Nova Notificação';
  const options = {
    body: payload.body || '',
    icon: payload.icon || '/pwa-192x192.png',
    badge: payload.badge || '/badge-72x72.png',
    tag: payload.tag,
    data: payload.data || { url: payload.url || '/' },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === targetUrl && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
`.trim()
}
