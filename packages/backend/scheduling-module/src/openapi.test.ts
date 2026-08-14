/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'

import { schedulingOpenApiPaths } from './openapi'
import { createSchedulingRoutes } from './http/routes'
import type { SchedulingModule } from './SchedulingModule'

const routesWithCalendarSync = createSchedulingRoutes({
  module: { useCases: {}, hasCalendarSync: true, hasVideoMeeting: false } as unknown as SchedulingModule,
})

describe('schedulingOpenApiPaths', () => {
  it('documenta TODA rota da tabela — rota nova sem path no spec quebra aqui', () => {
    const paths = schedulingOpenApiPaths({ routes: routesWithCalendarSync, basePath: '/v1' })

    for (const route of routesWithCalendarSync) {
      const openApiPath = `/v1${route.path.replace(/:([A-Za-z0-9_]+)/g, '{$1}')}`
      const operation = (paths[openApiPath] as Record<string, unknown> | undefined)?.[route.method.toLowerCase()]

      expect(operation).toBeDefined()
      expect((operation as { operationId: string }).operationId).toBe(route.operationId)
    }
  })

  it('converte parâmetro de rota para o formato do OpenAPI', () => {
    const paths = schedulingOpenApiPaths({ routes: routesWithCalendarSync, basePath: '/v1' })

    expect(paths['/v1/resources/{id}']).toBeDefined()
    expect(paths['/v1/resources/:id']).toBeUndefined()
  })

  it('agrupa métodos diferentes sob o mesmo path', () => {
    const paths = schedulingOpenApiPaths({ routes: routesWithCalendarSync, basePath: '/v1' })

    expect(Object.keys(paths['/v1/resources'] as object).sort()).toEqual(['get', 'post'])
    expect(Object.keys(paths['/v1/resources/{id}'] as object).sort()).toEqual(['delete', 'get', 'put'])
  })

  it('marca a tag do módulo, para o Swagger do host agrupar', () => {
    const paths = schedulingOpenApiPaths({ routes: routesWithCalendarSync, basePath: '/v1' })
    const listResources = (paths['/v1/resources'] as Record<string, Record<string, unknown>>).get

    expect(listResources?.tags).toEqual(['scheduling'])
  })

  it('declara 404 em rota com parâmetro, onde "de outra empresa" e "inexistente" se confundem', () => {
    const paths = schedulingOpenApiPaths({ routes: routesWithCalendarSync, basePath: '/v1' })
    const getResource = (paths['/v1/resources/{id}'] as Record<string, Record<string, unknown>>).get

    expect(Object.keys(getResource?.responses as object)).toContain('404')
  })

  it('documenta a rota de sincronização de calendário quando o módulo tem o provider', () => {
    const paths = schedulingOpenApiPaths({ routes: routesWithCalendarSync, basePath: '/v1' })
    const syncCalendar = (paths['/v1/bookings/{id}/sync-calendar'] as Record<string, Record<string, unknown>>)?.post

    expect(syncCalendar?.operationId).toBe('syncBookingCalendar')
  })
})

describe('rota de sincronização de calendário — montagem condicional (T5.5)', () => {
  it('some da tabela inteira quando o módulo não tem o provider, não só do doc', () => {
    const routesWithoutCalendarSync = createSchedulingRoutes({
      module: { useCases: {}, hasCalendarSync: false, hasVideoMeeting: false } as unknown as SchedulingModule,
    })

    expect(routesWithoutCalendarSync.some((route) => route.operationId === 'syncBookingCalendar')).toBe(false)

    const paths = schedulingOpenApiPaths({ routes: routesWithoutCalendarSync, basePath: '/v1' })
    expect(paths['/v1/bookings/{id}/sync-calendar']).toBeUndefined()
  })
})
