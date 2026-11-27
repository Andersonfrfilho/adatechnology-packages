/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { moduleOpenApiPaths, type OpenApiPaths } from '@adatechnology/module-http/openapi'
import type { ModuleRouteTable } from '@adatechnology/module-http'

/** Paths OpenAPI das rotas de fichas técnicas, já com a tag do módulo. */
export function recipeOpenApiPaths(params: { routes: ModuleRouteTable; basePath?: string }): OpenApiPaths {
  return moduleOpenApiPaths({ ...params, tags: ['recipes'] })
}

export type { OpenApiPaths }
