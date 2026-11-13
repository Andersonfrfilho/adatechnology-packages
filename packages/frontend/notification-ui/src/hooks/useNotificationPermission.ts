/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Hook headless para gerenciar permissão e ciclo de vida de Web Push no navegador.
 * Isomórfico: seguro em SSR/Node/Bun sem quebrar quando `window` ou `Notification` não existem.
 */

import { useCallback, useEffect, useState } from 'react'
import {
  getWebPushSubscription,
  isWebPushSupported,
  subscribeWebPush,
  unsubscribeWebPush,
} from '@adatechnology/notification-client'
import type { WebPushSubscription } from '@adatechnology/notification-contracts'

import { useOptionalNotificationContext } from '../NotificationProvider'

export type NotificationPermissionStatus = 'default' | 'granted' | 'denied' | 'unsupported'

export type UseNotificationPermissionOptions = {
  /** Chave pública VAPID necessária para inscrição Web Push. Se omitida, tenta buscar via client.getVapidPublicKey(). */
  readonly vapidPublicKey?: string
  /** Chave do localStorage para guardar a dispensa temporária do banner. Padrão: 'adatechnology:notification:permission-dismissed' */
  readonly storageKey?: string
  /** Validade da dispensa em ms (padrão: 7 dias). 0 para permanente. */
  readonly dismissTtlMs?: number
  /** Chave do localStorage onde o id do dispositivo registrado é salvo. Padrão: 'adatechnology:notification:device-id' */
  readonly deviceStorageKey?: string
  /** Callback executado após inscrição bem-sucedida. */
  readonly onSubscribe?: (subscription: WebPushSubscription) => Promise<void> | void
  /** Callback executado após cancelamento/desativação. */
  readonly onUnsubscribe?: () => Promise<void> | void
  /** ServiceWorkerRegistration específico (opcional, senão aguarda navigator.serviceWorker.ready). */
  readonly serviceWorkerRegistration?: ServiceWorkerRegistration
}

export type UseNotificationPermissionResult = {
  readonly permission: NotificationPermissionStatus
  readonly isSupported: boolean
  readonly isSubscribed: boolean
  readonly isDismissed: boolean
  readonly isPending: boolean
  readonly error: Error | null
  readonly requestPermission: () => Promise<boolean>
  readonly disableNotifications: () => Promise<boolean>
  readonly dismiss: () => void
  readonly resetDismissed: () => void
}

const DEFAULT_STORAGE_KEY = 'adatechnology:notification:permission-dismissed'
const DEFAULT_DEVICE_KEY = 'adatechnology:notification:device-id'
const DEFAULT_DISMISS_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 dias

export function readCurrentNotificationPermission(): NotificationPermissionStatus {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported'
  }
  return Notification.permission as NotificationPermissionStatus
}

export function checkIsNotificationDismissed(storageKey: string, dismissTtlMs: number): boolean {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return false
  }

  try {
    const raw = window.localStorage.getItem(storageKey)
    if (!raw) return false

    const parsed = JSON.parse(raw) as { dismissedAt?: number }
    if (!parsed?.dismissedAt) return false

    if (dismissTtlMs > 0 && Date.now() - parsed.dismissedAt > dismissTtlMs) {
      window.localStorage.removeItem(storageKey)
      return false
    }

    return true
  } catch {
    return false
  }
}

export function useNotificationPermission(options?: UseNotificationPermissionOptions): UseNotificationPermissionResult {
  const context = useOptionalNotificationContext()

  const storageKey = options?.storageKey ?? DEFAULT_STORAGE_KEY
  const deviceStorageKey = options?.deviceStorageKey ?? DEFAULT_DEVICE_KEY
  const dismissTtlMs = options?.dismissTtlMs ?? DEFAULT_DISMISS_TTL_MS

  const isSupported = isWebPushSupported()
  const [permission, setPermission] = useState<NotificationPermissionStatus>(readCurrentNotificationPermission)
  const [isSubscribed, setIsSubscribed] = useState<boolean>(false)
  const [isDismissed, setIsDismissed] = useState<boolean>(() => checkIsNotificationDismissed(storageKey, dismissTtlMs))
  const [isPending, setIsPending] = useState<boolean>(false)
  const [error, setError] = useState<Error | null>(null)

  // Atualiza estado de permissão e inscrição existente no mount
  useEffect(() => {
    setPermission(readCurrentNotificationPermission())
    setIsDismissed(checkIsNotificationDismissed(storageKey, dismissTtlMs))

    if (!isSupported) return

    let isMounted = true
    getWebPushSubscription(options?.serviceWorkerRegistration)
      .then((sub) => {
        if (isMounted && sub) {
          setIsSubscribed(true)
        }
      })
      .catch(() => {
        // Falha silenciosa em navegadores que restringem push em iframe/modo anônimo
      })

    return () => {
      isMounted = false
    }
  }, [isSupported, storageKey, dismissTtlMs, options?.serviceWorkerRegistration])

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return false
    }

    setIsPending(true)
    setError(null)

    try {
      const result = await Notification.requestPermission()
      const updatedStatus = result as NotificationPermissionStatus
      setPermission(updatedStatus)

      if (updatedStatus !== 'granted') {
        setIsPending(false)
        return false
      }

      // Tenta obter a chave VAPID via options ou client
      let vapidKey = options?.vapidPublicKey
      if (!vapidKey && context?.client) {
        try {
          vapidKey = await context.client.getVapidPublicKey()
        } catch {
          // O backend pode não expor rota pública de VAPID; segue se não houver
        }
      }

      if (vapidKey) {
        const subscription = await subscribeWebPush({
          vapidPublicKey: vapidKey,
          serviceWorkerRegistration: options?.serviceWorkerRegistration,
        })

        if (subscription) {
          setIsSubscribed(true)

          if (context?.client) {
            try {
              const device = await context.client.registerWebPush(subscription)
              if (typeof window !== 'undefined' && window.localStorage) {
                window.localStorage.setItem(deviceStorageKey, device.id)
              }
            } catch {
              // Registro de device pode ser completado posteriormente
            }
          }

          if (options?.onSubscribe) {
            await options.onSubscribe(subscription)
          }
        }
      }

      // Concedido com sucesso: limpa qualquer flag de dispensa anterior
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(storageKey)
      }
      setIsDismissed(false)
      setIsPending(false)
      return true
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)))
      setIsPending(false)
      return false
    }
  }, [
    context?.client,
    deviceStorageKey,
    options?.onSubscribe,
    options?.serviceWorkerRegistration,
    options?.vapidPublicKey,
    storageKey,
  ])

  const disableNotifications = useCallback(async (): Promise<boolean> => {
    setIsPending(true)
    setError(null)

    try {
      await unsubscribeWebPush(options?.serviceWorkerRegistration)

      if (context?.client && typeof window !== 'undefined' && window.localStorage) {
        const deviceId = window.localStorage.getItem(deviceStorageKey)
        if (deviceId) {
          await context.client.unregisterDevice(deviceId).catch(() => undefined)
          window.localStorage.removeItem(deviceStorageKey)
        }
      }

      if (options?.onUnsubscribe) {
        await options.onUnsubscribe()
      }

      setIsSubscribed(false)
      setIsPending(false)
      return true
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)))
      setIsPending(false)
      return false
    }
  }, [context?.client, deviceStorageKey, options?.onUnsubscribe, options?.serviceWorkerRegistration])

  const dismiss = useCallback((): void => {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(storageKey, JSON.stringify({ dismissedAt: Date.now() }))
      } catch {
        // Ignora erros de quota de storage
      }
    }
    setIsDismissed(true)
  }, [storageKey])

  const resetDismissed = useCallback((): void => {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.removeItem(storageKey)
      } catch {
        // Ignora erros de storage
      }
    }
    setIsDismissed(false)
  }, [storageKey])

  return {
    permission,
    isSupported,
    isSubscribed,
    isDismissed,
    isPending,
    error,
    requestPermission,
    disableNotifications,
    dismiss,
    resetDismissed,
  }
}
