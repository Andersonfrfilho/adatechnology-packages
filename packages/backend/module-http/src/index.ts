/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

export { HTTP_METHOD, ROUTE_SCOPE, isDomainErrorShape } from './types'
export type {
  HttpMethod,
  RouteScope,
  AuthContext,
  AuthContextResolverPort,
  RequestContext,
  SseEvent,
  SseSubscription,
  StreamResult,
  JsonResult,
  EmptyResult,
  HttpResult,
  ModuleRoute,
  ModuleRouteTable,
  LoggerPort,
  LogMeta,
  DomainErrorShape,
} from './types'

export { compileRoutes, dispatchRoute, findRoute } from './dispatchRoute'
export type { CompiledRoute, RawRequest, DispatchRouteParams } from './dispatchRoute'

export { toErrorResult, toValidationResult, VALIDATION_ERROR_CODE, INTERNAL_ERROR_CODE } from './errorFilter'
export type { ValidationIssue } from './errorFilter'

export { compilePath, matchPath } from './pathMatcher'
export type { CompiledPath } from './pathMatcher'
