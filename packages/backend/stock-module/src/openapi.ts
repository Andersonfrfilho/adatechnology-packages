/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { moduleOpenApiPaths, type OpenApiPaths } from '@adatechnology/module-http/openapi'
import type { ModuleRouteTable } from '@adatechnology/module-http'

/** Paths OpenAPI das rotas de estoque, já com a tag do módulo. */
export function stockOpenApiPaths(params: { routes: ModuleRouteTable; basePath?: string }): OpenApiPaths {
  return moduleOpenApiPaths({ ...params, tags: ['stock'] })
}

export type { OpenApiPaths }
