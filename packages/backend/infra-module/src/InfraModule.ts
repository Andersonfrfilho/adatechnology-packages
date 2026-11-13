/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Composição raiz. O host entrega a conexão, o cache e as portas de auditoria e de senha; o módulo
 * monta repositórios, gateway do provedor, casos de uso e rotas. Não lê `process.env`.
 */

import type {
  InfraAuditRecorderInterface,
  InfraCacheInterface,
  InfraDriver,
  InfraGatewayInterface,
  InfraGatewayProviderLogger,
  InfraPasswordVerifierInterface,
  InfraRateLimiterInterface,
  InfraSleep,
  ResolveGateway,
} from '@adatechnology/infra-contracts'

import type { InfraDatabase } from './database.types'
import { DefaultInfraGatewayProvider } from './InfraGatewayProvider'
import { GetInfraCostsUseCase } from './getInfraCosts.use-case'
import { GetInfraIntegrationUseCase } from './getInfraIntegration.use-case'
import { GetInfraOperationUseCase } from './getInfraOperation.use-case'
import { createInfraRoutes, type InfraModuleRoute } from './http/createInfraRoutes'
import { ListInfraEnvironmentsUseCase } from './listInfraEnvironments.use-case'
import { PowerOffEnvironmentUseCase } from './powerOffEnvironment.use-case'
import { PowerOnEnvironmentUseCase } from './powerOnEnvironment.use-case'
import { RecoverInterruptedInfraOperationsUseCase } from './recoverInterruptedInfraOperations.use-case'
import { RemoveInfraIntegrationUseCase } from './removeInfraIntegration.use-case'
import { DrizzleInfraIntegrationRepository } from './repositories/DrizzleInfraIntegrationRepository'
import { DrizzleInfraOperationRepository } from './repositories/DrizzleInfraOperationRepository'
import { DrizzleInfraScheduleRepository } from './repositories/DrizzleInfraScheduleRepository'
import { RunInfraSchedulesUseCase } from './runInfraSchedules.use-case'
import { SaveEnvironmentScheduleUseCase } from './saveEnvironmentSchedule.use-case'
import { SaveInfraIntegrationUseCase } from './saveInfraIntegration.use-case'
import { VerifyInfraIntegrationUseCase } from './verifyInfraIntegration.use-case'

export type InfraModuleConfig = {
  readonly env: string
  /** Token do provedor vindo do ambiente; vazio = o token só pode vir do painel. */
  readonly environmentToken: string
  readonly workspaceId: string
  readonly environmentId: string
  /** Base64 de 32 bytes; vazio desliga a gravação do token pelo painel. */
  readonly encryptionKeyBase64: string
  readonly managedPattern: string
  readonly databaseWaitSeconds: number
  /** Provedor de nuvem; ausente = `railway`. */
  readonly driver?: InfraDriver
}

export type InfraModuleProviders = {
  readonly cache: InfraCacheInterface
  readonly audit: InfraAuditRecorderInterface
  readonly passwordVerifier: InfraPasswordVerifierInterface
  readonly logger: InfraGatewayProviderLogger
  /** Nome exibido de quem configurou a integração; ausente = a tela não mostra o nome. */
  readonly findAgentName?: (agentId: string) => Promise<string | undefined>
  /** Limite por administrador autenticado; ausente = só o limite por IP do host. */
  readonly rateLimiter?: InfraRateLimiterInterface
  readonly sleep?: InfraSleep
  readonly now?: () => Date
}

export type CreateInfraModuleParams = {
  readonly db: InfraDatabase
  readonly config: InfraModuleConfig
  readonly providers: InfraModuleProviders
}

export type InfraModule = {
  readonly useCases: {
    readonly listInfraEnvironments: ListInfraEnvironmentsUseCase
    readonly powerOffEnvironment: PowerOffEnvironmentUseCase
    readonly powerOnEnvironment: PowerOnEnvironmentUseCase
    readonly saveEnvironmentSchedule: SaveEnvironmentScheduleUseCase
    readonly getInfraCosts: GetInfraCostsUseCase
    readonly getInfraOperation: GetInfraOperationUseCase
    readonly recoverInterruptedOperations: RecoverInterruptedInfraOperationsUseCase
    readonly runInfraSchedules: RunInfraSchedulesUseCase
    readonly getInfraIntegration: GetInfraIntegrationUseCase
    readonly saveInfraIntegration: SaveInfraIntegrationUseCase
    readonly removeInfraIntegration: RemoveInfraIntegrationUseCase
    readonly verifyInfraIntegration: VerifyInfraIntegrationUseCase
  }
  /** Tabela de rotas para o host montar; a autenticação e o limite por IP são dele. */
  readonly routes: readonly InfraModuleRoute[]
  readonly resolveGateway: ResolveGateway
  readonly isGatewayCurrent: (gateway: InfraGatewayInterface) => boolean
}

const defaultSleep: InfraSleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))

export function createInfraModule(params: CreateInfraModuleParams): InfraModule {
  const { db, config, providers } = params
  const { cache, audit, logger } = providers
  const now = providers.now ?? ((): Date => new Date())
  const sleep = providers.sleep ?? defaultSleep

  const integrationRepository = new DrizzleInfraIntegrationRepository(db)
  const operationRepository = new DrizzleInfraOperationRepository(db)
  const scheduleRepository = new DrizzleInfraScheduleRepository(db)

  const gatewayProvider = new DefaultInfraGatewayProvider({
    config: {
      env: config.env,
      environmentToken: config.environmentToken,
      workspaceId: config.workspaceId,
      environmentId: config.environmentId,
      encryptionKeyBase64: config.encryptionKeyBase64,
      ...(config.driver ? { driver: config.driver } : {}),
    },
    integrationRepository,
    now: Date.now,
    logger,
  })
  const resolveGateway: ResolveGateway = () => gatewayProvider.resolve()
  const isGatewayCurrent = (gateway: InfraGatewayInterface): boolean => gatewayProvider.isCurrent(gateway)

  const environmentPolicy = {
    managedPattern: config.managedPattern,
    selfEnvironmentId: config.environmentId,
    databaseWaitSeconds: config.databaseWaitSeconds,
  }
  const powerDependencies = {
    resolveGateway,
    cache,
    operationRepository,
    scheduleRepository,
    recordAudit: audit,
    logger,
    sleep,
    now,
    ...environmentPolicy,
  }
  const powerOffEnvironment = new PowerOffEnvironmentUseCase(powerDependencies)
  const powerOnEnvironment = new PowerOnEnvironmentUseCase(powerDependencies)
  const recoverInterruptedOperations = new RecoverInterruptedInfraOperationsUseCase({
    operationRepository,
    recordAudit: audit,
    logger,
    databaseWaitSeconds: config.databaseWaitSeconds,
    now,
  })

  const integrationWriteDependencies = {
    config: {
      env: config.env,
      workspaceId: config.workspaceId,
      environmentId: config.environmentId,
      encryptionKeyBase64: config.encryptionKeyBase64,
      environmentToken: config.environmentToken,
    },
    integrationRepository,
    gatewayProvider,
    cache,
    verifyAgentPassword: providers.passwordVerifier,
    recordAudit: audit,
    logger,
  }

  const useCases: InfraModule['useCases'] = {
    listInfraEnvironments: new ListInfraEnvironmentsUseCase({
      resolveGateway,
      isGatewayCurrent,
      cache,
      operationRepository,
      scheduleRepository,
      now,
      ...environmentPolicy,
    }),
    powerOffEnvironment,
    powerOnEnvironment,
    saveEnvironmentSchedule: new SaveEnvironmentScheduleUseCase({
      resolveGateway,
      scheduleRepository,
      recordAudit: audit,
      managedPattern: config.managedPattern,
      selfEnvironmentId: config.environmentId,
    }),
    getInfraCosts: new GetInfraCostsUseCase({ resolveGateway, isGatewayCurrent, cache, sleep, now }),
    getInfraOperation: new GetInfraOperationUseCase({ operationRepository }),
    recoverInterruptedOperations,
    runInfraSchedules: new RunInfraSchedulesUseCase({
      resolveGateway,
      scheduleRepository,
      powerOnEnvironment,
      powerOffEnvironment,
      recoverInterruptedOperations,
      logger,
      now,
    }),
    getInfraIntegration: new GetInfraIntegrationUseCase({
      gatewayProvider,
      cache,
      findAgentName: providers.findAgentName ?? (async () => undefined),
    }),
    saveInfraIntegration: new SaveInfraIntegrationUseCase(integrationWriteDependencies),
    removeInfraIntegration: new RemoveInfraIntegrationUseCase(integrationWriteDependencies),
    verifyInfraIntegration: new VerifyInfraIntegrationUseCase({
      gatewayProvider,
      cache,
      recordAudit: audit,
      logger,
    }),
  }

  return {
    useCases,
    routes: createInfraRoutes({
      listInfraEnvironments: useCases.listInfraEnvironments,
      powerOffEnvironment: useCases.powerOffEnvironment,
      powerOnEnvironment: useCases.powerOnEnvironment,
      getInfraOperation: useCases.getInfraOperation,
      getInfraCosts: useCases.getInfraCosts,
      saveEnvironmentSchedule: useCases.saveEnvironmentSchedule,
      getInfraIntegration: useCases.getInfraIntegration,
      saveInfraIntegration: useCases.saveInfraIntegration,
      removeInfraIntegration: useCases.removeInfraIntegration,
      verifyInfraIntegration: useCases.verifyInfraIntegration,
      ...(providers.rateLimiter ? { rateLimiter: providers.rateLimiter } : {}),
    }),
    resolveGateway,
    isGatewayCurrent,
  }
}
