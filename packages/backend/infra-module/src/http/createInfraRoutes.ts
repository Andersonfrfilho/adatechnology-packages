/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Tabela de rotas declarativa (`@adatechnology/module-http`): sem tipo de framework. O host monta
 * pelo adaptador dele (`/fetch`, `/uws`) ou traduz a tabela para o próprio router. Autenticação é do
 * host: a identidade chega pronta em `context.auth`, com `userId` = id do administrador.
 */

import { z } from 'zod'

import { HTTP_METHOD, ROUTE_SCOPE } from '@adatechnology/module-http'
import type { HttpResult, ModuleRoute, RequestContext } from '@adatechnology/module-http'
import {
  INFRA_ADMIN_SCOPE,
  INFRA_AGENT_BUCKET,
  INFRA_AUDIT_ACTOR_TYPE,
  INFRA_OPERATION_TRIGGER,
  INFRA_RATE_LIMIT_PROFILE,
  INFRA_RATE_LIMITED_CODE,
  INFRA_ROUTE_PATH,
  infraEnvironmentParamsSchema,
  infraIntegrationRemoveBodySchema,
  infraIntegrationSaveBodySchema,
  infraOperationParamsSchema,
  infraPowerOnBodySchema,
  infraScheduleBodySchema,
} from '@adatechnology/infra-contracts'
import type {
  InfraEnvironmentView,
  InfraRateLimitProfile,
  InfraRoutesDependencies,
  PowerEnvironmentParams,
  PowerEnvironmentResult,
} from '@adatechnology/infra-contracts'

export type InfraModuleRoute = ModuleRoute & {
  /** O host traduz o perfil para a regra de limite por IP dele. */
  readonly rateLimitProfile: InfraRateLimitProfile
  /** Resposta com segredo ou estado sensível: o host põe `Cache-Control: no-store` também em erro. */
  readonly isNoStore: boolean
}

type PowerUseCase = { execute(params: PowerEnvironmentParams): Promise<PowerEnvironmentResult> }

const NO_STORE_HEADERS = { 'Cache-Control': 'no-store' } as const
const ACCEPTED = 202
const TOO_MANY_REQUESTS = 429

const optionalBody = <TSchema extends z.ZodTypeAny>(schema: TSchema): z.ZodTypeAny =>
  z.preprocess((value) => value ?? {}, schema)

function data(body: unknown, status = 200, headers?: Readonly<Record<string, string>>): HttpResult {
  return { kind: 'json', status, body: { data: body }, ...(headers ? { headers } : {}) }
}

function requireAdminId(context: RequestContext): string {
  const adminId = context.auth?.userId
  if (!adminId) throw new Error('Rota de infraestrutura sem administrador autenticado')
  return adminId
}

/** O limite por IP roda antes da autenticação e o IP é forjável; este só conta quem já se autenticou. */
async function consumeAdminLimit(params: {
  readonly dependencies: InfraRoutesDependencies
  readonly bucket: string
  readonly identity: string
  readonly profile: InfraRateLimitProfile
}): Promise<HttpResult | undefined> {
  const { dependencies, bucket, identity, profile } = params
  if (!dependencies.rateLimiter) return undefined
  const verdict = await dependencies.rateLimiter.consume({ bucket, identity, profile })
  if (verdict.isAllowed) return undefined

  return {
    kind: 'json',
    status: TOO_MANY_REQUESTS,
    body: { error: { code: INFRA_RATE_LIMITED_CODE, message: 'Muitas requisicoes' } },
    headers: { 'Retry-After': String(verdict.retryAfterSeconds) },
  }
}

/** O registro da agenda carrega `updatedByAgentId`; o painel não precisa saber quem editou por último. */
function toEnvironmentResponse(environment: InfraEnvironmentView): unknown {
  const { schedule, ...rest } = environment
  if (!schedule) return rest

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { updatedByAgentId: _updatedByAgentId, ...publicSchedule } = schedule
  return { ...rest, schedule: publicSchedule }
}

function buildPowerRoute(params: {
  readonly dependencies: InfraRoutesDependencies
  readonly useCase: PowerUseCase
  readonly path: string
  readonly operationId: string
  readonly summary: string
  readonly bucket: string
  readonly isKeepOnUntilAccepted: boolean
}): InfraModuleRoute {
  const { dependencies, useCase, bucket, isKeepOnUntilAccepted } = params

  return {
    method: HTTP_METHOD.POST,
    path: params.path,
    scope: ROUTE_SCOPE.ADMIN,
    requiredScopes: [INFRA_ADMIN_SCOPE],
    operationId: params.operationId,
    summary: params.summary,
    rateLimitProfile: INFRA_RATE_LIMIT_PROFILE.POWER,
    isNoStore: false,
    ...(isKeepOnUntilAccepted ? { bodySchema: optionalBody(infraPowerOnBodySchema) } : {}),
    handler: async (context) => {
      const { environmentId } = infraEnvironmentParamsSchema.parse(context.params)
      const adminId = requireAdminId(context)
      const denied = await consumeAdminLimit({
        dependencies,
        bucket,
        identity: adminId,
        profile: INFRA_RATE_LIMIT_PROFILE.POWER_PER_AGENT,
      })
      if (denied) return denied

      const { keepOnUntil } = isKeepOnUntilAccepted
        ? infraPowerOnBodySchema.parse(context.body ?? {})
        : { keepOnUntil: undefined }
      const result = await useCase.execute({
        environmentId,
        actor: { type: INFRA_AUDIT_ACTOR_TYPE.AGENT, agentId: adminId },
        trigger: INFRA_OPERATION_TRIGGER.MANUAL,
        ipAddress: context.ip,
        ...(keepOnUntil ? { keepOnUntil: new Date(keepOnUntil) } : {}),
      })

      return data({ operationId: result.operationId }, ACCEPTED)
    },
  }
}

function buildEnvironmentRoutes(dependencies: InfraRoutesDependencies): readonly InfraModuleRoute[] {
  const read = { scope: ROUTE_SCOPE.ADMIN, requiredScopes: [INFRA_ADMIN_SCOPE], isNoStore: false } as const

  return [
    {
      ...read,
      method: HTTP_METHOD.GET,
      path: INFRA_ROUTE_PATH.ENVIRONMENTS,
      operationId: 'listInfraEnvironments',
      summary: 'Lista projetos e ambientes do provedor, com estado, custo e agenda',
      rateLimitProfile: INFRA_RATE_LIMIT_PROFILE.READ,
      handler: async () => {
        const result = await dependencies.listInfraEnvironments.execute()

        return data({
          access: result.access,
          projects: result.projects.map((project) => ({
            ...project,
            environments: project.environments.map(toEnvironmentResponse),
          })),
        })
      },
    },
    buildPowerRoute({
      dependencies,
      useCase: dependencies.powerOffEnvironment,
      path: `${INFRA_ROUTE_PATH.ENVIRONMENT}/power-off`,
      operationId: 'powerOffInfraEnvironment',
      summary: 'Desliga um ambiente em segundo plano',
      bucket: INFRA_AGENT_BUCKET.POWER_OFF,
      isKeepOnUntilAccepted: false,
    }),
    buildPowerRoute({
      dependencies,
      useCase: dependencies.powerOnEnvironment,
      path: `${INFRA_ROUTE_PATH.ENVIRONMENT}/power-on`,
      operationId: 'powerOnInfraEnvironment',
      summary: 'Liga um ambiente em segundo plano',
      bucket: INFRA_AGENT_BUCKET.POWER_ON,
      isKeepOnUntilAccepted: true,
    }),
    {
      ...read,
      method: HTTP_METHOD.GET,
      path: INFRA_ROUTE_PATH.OPERATION,
      operationId: 'getInfraOperation',
      summary: 'Estado de uma operação de ligar ou desligar',
      rateLimitProfile: INFRA_RATE_LIMIT_PROFILE.READ,
      handler: async (context) => {
        const { operationId } = infraOperationParamsSchema.parse(context.params)

        return data(await dependencies.getInfraOperation.execute({ operationId }))
      },
    },
    {
      ...read,
      method: HTTP_METHOD.GET,
      path: INFRA_ROUTE_PATH.COSTS,
      operationId: 'getInfraCosts',
      summary: 'Custo do ciclo de cobrança por projeto e ambiente',
      rateLimitProfile: INFRA_RATE_LIMIT_PROFILE.READ,
      handler: async () => data(await dependencies.getInfraCosts.execute()),
    },
    {
      ...read,
      method: HTTP_METHOD.PUT,
      path: `${INFRA_ROUTE_PATH.ENVIRONMENT}/schedule`,
      operationId: 'saveInfraEnvironmentSchedule',
      summary: 'Salva a agenda de um ambiente',
      rateLimitProfile: INFRA_RATE_LIMIT_PROFILE.WRITE,
      bodySchema: optionalBody(infraScheduleBodySchema),
      handler: async (context) => {
        const { environmentId } = infraEnvironmentParamsSchema.parse(context.params)
        const adminId = requireAdminId(context)
        const body = infraScheduleBodySchema.parse(context.body ?? {})

        const result = await dependencies.saveEnvironmentSchedule.execute({
          ...body,
          environmentId,
          actor: { type: INFRA_AUDIT_ACTOR_TYPE.AGENT, agentId: adminId },
          ipAddress: context.ip,
        })
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { updatedByAgentId: _updatedByAgentId, ...schedule } = result.schedule

        return data({ ...schedule, nextScheduledAction: result.nextScheduledAction })
      },
    },
  ]
}

function buildIntegrationRoutes(dependencies: InfraRoutesDependencies): readonly InfraModuleRoute[] {
  const common = { scope: ROUTE_SCOPE.ADMIN, requiredScopes: [INFRA_ADMIN_SCOPE], isNoStore: true } as const

  return [
    {
      ...common,
      method: HTTP_METHOD.GET,
      path: INFRA_ROUTE_PATH.INTEGRATION,
      operationId: 'getInfraIntegration',
      summary: 'Estado da integração com o provedor, sem nunca devolver o token',
      rateLimitProfile: INFRA_RATE_LIMIT_PROFILE.READ,
      handler: async () => data(await dependencies.getInfraIntegration.execute(), 200, NO_STORE_HEADERS),
    },
    {
      ...common,
      method: HTTP_METHOD.PUT,
      path: INFRA_ROUTE_PATH.INTEGRATION,
      operationId: 'saveInfraIntegration',
      summary: 'Testa e grava o token do provedor, cifrado',
      rateLimitProfile: INFRA_RATE_LIMIT_PROFILE.INTEGRATION_WRITE,
      bodySchema: optionalBody(infraIntegrationSaveBodySchema),
      handler: async (context) => {
        const adminId = requireAdminId(context)
        const denied = await consumeAdminLimit({
          dependencies,
          bucket: INFRA_AGENT_BUCKET.INTEGRATION_SAVE,
          identity: adminId,
          profile: INFRA_RATE_LIMIT_PROFILE.INTEGRATION_WRITE,
        })
        if (denied) return denied

        const { token, password } = infraIntegrationSaveBodySchema.parse(context.body ?? {})
        const view = await dependencies.saveInfraIntegration.execute({
          actor: { agentId: adminId },
          ipAddress: context.ip,
          token,
          password,
        })

        return data(view, 200, NO_STORE_HEADERS)
      },
    },
    {
      ...common,
      method: HTTP_METHOD.POST,
      path: INFRA_ROUTE_PATH.INTEGRATION_VERIFY,
      operationId: 'verifyInfraIntegration',
      summary: 'Testa o acesso ao workspace com o token salvo',
      rateLimitProfile: INFRA_RATE_LIMIT_PROFILE.INTEGRATION_VERIFY,
      handler: async (context) => {
        const adminId = requireAdminId(context)
        const denied = await consumeAdminLimit({
          dependencies,
          bucket: INFRA_AGENT_BUCKET.INTEGRATION_VERIFY,
          identity: adminId,
          profile: INFRA_RATE_LIMIT_PROFILE.INTEGRATION_VERIFY,
        })
        if (denied) return denied

        const view = await dependencies.verifyInfraIntegration.execute({
          actor: { agentId: adminId },
          ipAddress: context.ip,
        })

        return data(view, 200, NO_STORE_HEADERS)
      },
    },
    {
      ...common,
      method: HTTP_METHOD.DELETE,
      path: INFRA_ROUTE_PATH.INTEGRATION,
      operationId: 'removeInfraIntegration',
      summary: 'Apaga o token guardado; não o revoga no provedor',
      rateLimitProfile: INFRA_RATE_LIMIT_PROFILE.INTEGRATION_WRITE,
      bodySchema: optionalBody(infraIntegrationRemoveBodySchema),
      handler: async (context) => {
        const adminId = requireAdminId(context)
        const denied = await consumeAdminLimit({
          dependencies,
          bucket: INFRA_AGENT_BUCKET.INTEGRATION_REMOVE,
          identity: adminId,
          profile: INFRA_RATE_LIMIT_PROFILE.INTEGRATION_WRITE,
        })
        if (denied) return denied

        const { password } = infraIntegrationRemoveBodySchema.parse(context.body ?? {})
        const view = await dependencies.removeInfraIntegration.execute({
          actor: { agentId: adminId },
          ipAddress: context.ip,
          password,
        })

        return data(view, 200, NO_STORE_HEADERS)
      },
    },
  ]
}

export function createInfraRoutes(dependencies: InfraRoutesDependencies): readonly InfraModuleRoute[] {
  return [...buildEnvironmentRoutes(dependencies), ...buildIntegrationRoutes(dependencies)]
}
