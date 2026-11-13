/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import type { ModuleRouteTable } from '@adatechnology/module-http'

import type { UserModule } from '../UserModule'
import { buildAdminRoutes } from './adminRoutes'
import { buildAuthRoutes } from './authRoutes'

export function createUserRoutes(params: { readonly module: UserModule }): ModuleRouteTable {
  return [...buildAuthRoutes(params.module), ...buildAdminRoutes(params.module)]
}
