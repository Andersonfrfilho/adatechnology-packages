/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'
import type { NotificationRoute } from '@adatechnology/notification-contracts'

import { notificationOpenApiPaths } from './openapi'
import { createNotificationRoutes } from './http/routes'
import type { NotificationModule } from './NotificationModule'

// A tabela real do módulo, com um stub de use-cases: o que importa aqui é a FORMA das rotas
// (path, método, operationId), não o comportamento delas.
const stubModule = { useCases: {} } as unknown as NotificationModule
const routes = createNotificationRoutes({ module: stubModule, webhookSecret: 'segredo' })

describe('notificationOpenApiPaths', () => {
  it('converte parâmetro de rota para o formato do OpenAPI', () => {
    const paths = notificationOpenApiPaths({ routes, basePath: '/v1' })

    expect(paths['/v1/notifications/{id}/read']).toBeDefined()
    expect(paths['/v1/notifications/:id/read']).toBeUndefined()
  })

  it('documenta TODA rota da tabela — rota nova sem path no spec quebra aqui', () => {
    const paths = notificationOpenApiPaths({ routes, basePath: '/v1' })

    for (const route of routes) {
      const openApiPath = `/v1${route.path.replace(/:([A-Za-z0-9_]+)/g, '{$1}')}`
      const operation = (paths[openApiPath] as Record<string, unknown> | undefined)?.[route.method.toLowerCase()]

      expect(operation).toBeDefined()
      expect((operation as { operationId: string }).operationId).toBe(route.operationId)
    }
  })

  it('agrupa métodos diferentes sob o mesmo path', () => {
    const paths = notificationOpenApiPaths({ routes, basePath: '/v1' })
    const preferences = paths['/v1/notification-preferences'] as Record<string, unknown>

    expect(Object.keys(preferences).sort()).toEqual(['get', 'put'])
  })

  it('declara 401/403 em rota autenticada e omite em rota pública', () => {
    const paths = notificationOpenApiPaths({ routes, basePath: '/v1' })
    const inbox = (paths['/v1/notifications'] as Record<string, Record<string, unknown>>).get
    const webhook = (paths['/v1/notification-webhooks/{driver}'] as Record<string, Record<string, unknown>>).post

    expect(Object.keys(inbox?.responses as object)).toContain('401')
    expect(Object.keys(webhook?.responses as object)).not.toContain('401')
  })

  it('declara 404 em rota com parâmetro, onde "de outro usuário" e "inexistente" se confundem', () => {
    const paths = notificationOpenApiPaths({ routes, basePath: '/v1' })
    const markRead = (paths['/v1/notifications/{id}/read'] as Record<string, Record<string, unknown>>).patch

    expect(Object.keys(markRead?.responses as object)).toContain('404')
  })

  it('respeita basePath vazio', () => {
    const paths = notificationOpenApiPaths({ routes })
    expect(paths['/notifications']).toBeDefined()
  })

  it('marca requestBody só onde há schema de corpo', () => {
    const withBody: NotificationRoute[] = routes.filter((route) => route.bodySchema !== undefined)
    const paths = notificationOpenApiPaths({ routes, basePath: '/v1' })

    expect(withBody.length).toBeGreaterThan(0)
    for (const route of withBody) {
      const openApiPath = `/v1${route.path.replace(/:([A-Za-z0-9_]+)/g, '{$1}')}`
      const operation = (paths[openApiPath] as Record<string, Record<string, unknown>>)[route.method.toLowerCase()]
      expect(operation?.requestBody).toBeDefined()
    }
  })
})
