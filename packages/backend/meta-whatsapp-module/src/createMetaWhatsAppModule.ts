import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres'
import type { AnyRelations, EmptyRelations } from 'drizzle-orm/relations'
import { WhatsAppMessageProvider } from '@adatechnology/meta-whatsapp-provider'
import type {
  CatalogPort,
  ChannelAdapterInterface,
  FlowActionHandler,
  FlowActionKind,
  MetaWhatsAppHooks,
  ObjectStorageInterface,
  RealtimeNotifierInterface,
  SessionState,
  SubjectResolverInterface,
} from '@adatechnology/meta-whatsapp-contracts'
import { SessionRepository } from './repositories/SessionRepository'
import { MessageRepository } from './repositories/MessageRepository'
import { FlowGraphRepository } from './repositories/FlowGraphRepository'
import { SettingsRepository } from './repositories/SettingsRepository'
import { LogMessageUseCase } from './use-cases/LogMessage.use-case'
import { SendMessageUseCase } from './use-cases/SendMessage.use-case'
import { TakeoverConversationUseCase } from './use-cases/TakeoverConversation.use-case'
import { ReleaseConversationUseCase } from './use-cases/ReleaseConversation.use-case'
import { ListConversationsUseCase } from './use-cases/ListConversations.use-case'
import { ListMessagesUseCase } from './use-cases/ListMessages.use-case'
import { ExportConversationUseCase } from './use-cases/ExportConversation.use-case'
import {
  GetFlowGraphUseCase,
  ListFlowGraphsUseCase,
  CreateFlowGraphUseCase,
  SaveFlowGraphUseCase,
  DeleteFlowGraphUseCase,
  GetLiveFlowPositionsUseCase,
} from './use-cases/FlowGraph.use-cases'
import { FlowInterpreter } from './flows/FlowInterpreter'
import { WhatsAppChannelAdapter } from './channel/WhatsAppChannelAdapter'
import { ReceiveWebhookUseCase } from './channel/ReceiveWebhook.use-case'
import { IngestInboundMediaUseCase } from './channel/IngestInboundMedia.use-case'
import { verifyWebhookChallenge, type NonceStoreInterface } from './channel/webhookSecurity'

export interface MetaWhatsAppModuleConfig {
  phoneNumberId: string
  accessToken: string
  webhookVerifyToken: string
  appSecret: string
  wabaId?: string
  apiVersion?: string
  // Aponta para um mock local em dev/teste; undefined usa a Graph API real.
  baseUrl?: string
}

export interface MetaWhatsAppModuleFeatures {
  // T4.4 — desliga o motor de grafo. Um produto cuja conversa é dirigida por código próprio
  // (o QuickCart tem o seu ConversationEngine) não deve nem carregar o interpretador, e o
  // módulo não pode presumir que todo consumidor quer fluxo visual.
  flowEngine?: boolean
}

export interface MetaWhatsAppModuleProviders {
  objectStorage?: ObjectStorageInterface
  realtime?: RealtimeNotifierInterface
  subjectResolver?: SubjectResolverInterface
  // Opcional por desenho — sem catálogo injetado o módulo sobe e funciona, só os recursos de
  // produto ficam desligados (ver .specs/features/meta-catalog-trio/spec.md §4).
  catalog?: CatalogPort
}

export interface CreateMetaWhatsAppModuleParams {
  db: BunSQLDatabase<AnyRelations | EmptyRelations>
  config: MetaWhatsAppModuleConfig
  // Cache compartilhado entre instâncias para o anti-replay do webhook.
  nonceStore: NonceStoreInterface
  // Estado inicial de uma sessão nova — o módulo não conhece a máquina de estados do produto.
  startState?: SessionState
  features?: MetaWhatsAppModuleFeatures
  providers?: MetaWhatsAppModuleProviders
  hooks?: MetaWhatsAppHooks
}

// T5.6 — costura conversa × canal. Tudo que é ambiente (db, credenciais, storage, cache,
// realtime) entra por parâmetro: o módulo não lê process.env nem abre conexão própria, que é o
// que permite ao host controlar pool, ciclo de vida e configuração por empresa.
export function createMetaWhatsAppModule(params: CreateMetaWhatsAppModuleParams) {
  const { db, config, nonceStore, providers = {}, hooks } = params
  const startState = params.startState ?? 'start'
  const flowEngineEnabled = params.features?.flowEngine ?? true

  const messageProvider = new WhatsAppMessageProvider({
    accessToken: config.accessToken,
    phoneNumberId: config.phoneNumberId,
    wabaId: config.wabaId,
    apiVersion: config.apiVersion,
    baseUrl: config.baseUrl,
  })
  const channel: ChannelAdapterInterface = new WhatsAppChannelAdapter(messageProvider)

  const sessionRepository = new SessionRepository(db)
  const messageRepository = new MessageRepository(db)
  const settingsRepository = new SettingsRepository(db)
  const flowGraphRepository = new FlowGraphRepository(db)

  const logMessage = new LogMessageUseCase(sessionRepository, messageRepository, providers.realtime)
  const sendMessage = new SendMessageUseCase(channel, sessionRepository, logMessage, providers.objectStorage)

  const receiveWebhook = new ReceiveWebhookUseCase({
    appSecret: config.appSecret,
    nonceStore,
    sessionRepository,
    messageRepository,
    logMessage,
    startState,
    hooks,
    realtime: providers.realtime,
  })

  // Só existe se a flag estiver ligada — não adianta o host "não usar" um interpretador que
  // ainda assim ficou instanciado e exposto na API pública do módulo.
  const flowInterpreter = flowEngineEnabled ? new FlowInterpreter() : undefined

  // Só existe com storage injetado — sem ele não há para onde copiar o binário, e devolver um
  // use-case que sempre falha seria pior do que a ausência ser visível no tipo.
  const ingestInboundMedia = providers.objectStorage
    ? new IngestInboundMediaUseCase(db, channel, providers.objectStorage)
    : undefined

  return {
    channel,
    // undefined quando providers.objectStorage não foi injetado.
    ingestInboundMedia,
    conversations: {
      log: logMessage,
      send: sendMessage,
      takeover: new TakeoverConversationUseCase(sessionRepository, providers.realtime),
      release: new ReleaseConversationUseCase(sessionRepository, providers.realtime),
      list: new ListConversationsUseCase(sessionRepository),
      listMessages: new ListMessagesUseCase(sessionRepository, messageRepository),
      export: new ExportConversationUseCase(sessionRepository),
      repository: sessionRepository,
    },
    settings: settingsRepository,
    webhook: {
      receive: receiveWebhook,
      // GET de verificação da Meta — o host liga na sua rota e devolve o retorno como texto puro.
      verifyChallenge: (query: { mode: string | null; token: string | null; challenge: string | null }) =>
        verifyWebhookChallenge({ ...query, expectedToken: config.webhookVerifyToken }),
    },
    // undefined quando features.flowEngine === false.
    flows: flowInterpreter
      ? {
          interpreter: flowInterpreter,
          registerFlowAction: (kind: FlowActionKind, handler: FlowActionHandler) =>
            flowInterpreter.registerFlowAction(kind, handler),
          get: new GetFlowGraphUseCase(flowGraphRepository),
          list: new ListFlowGraphsUseCase(flowGraphRepository),
          create: new CreateFlowGraphUseCase(flowGraphRepository),
          save: new SaveFlowGraphUseCase(flowGraphRepository),
          delete: new DeleteFlowGraphUseCase(flowGraphRepository),
          livePositions: new GetLiveFlowPositionsUseCase(flowGraphRepository),
          repository: flowGraphRepository,
        }
      : undefined,
    catalog: providers.catalog,
  }
}

export type MetaWhatsAppModule = ReturnType<typeof createMetaWhatsAppModule>
