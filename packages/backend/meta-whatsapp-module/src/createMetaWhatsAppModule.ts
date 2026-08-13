import { WhatsAppMessageProvider } from '@adatechnology/meta-whatsapp-provider'
import type { MetaWhatsAppDatabase } from './database.types'
import { FLOW_ACTION_KIND } from '@adatechnology/meta-whatsapp-contracts'
import type {
  CatalogPort,
  ChannelAdapterInterface,
  FlowActionHandler,
  FlowActionKind,
  MetaWhatsAppHooks,
  ObjectStorageInterface,
  CacheInterface,
  RealtimeNotifierInterface,
  SessionState,
  SubjectResolverInterface,
} from '@adatechnology/meta-whatsapp-contracts'
import { SessionRepository } from './repositories/SessionRepository'
import { MessageRepository } from './repositories/MessageRepository'
import { FlowGraphRepository } from './repositories/FlowGraphRepository'
import { FlowGraphCache, DEFAULT_FLOW_GRAPH_CACHE_TTL_SECONDS } from './repositories/FlowGraphCache'
import { SettingsRepository } from './repositories/SettingsRepository'
import { LogMessageUseCase, type MessageModerator } from './use-cases/LogMessage.use-case'
import { SendMessageUseCase } from './use-cases/SendMessage.use-case'
import { TakeoverConversationUseCase } from './use-cases/TakeoverConversation.use-case'
import { ReleaseConversationUseCase } from './use-cases/ReleaseConversation.use-case'
import { ListConversationsUseCase } from './use-cases/ListConversations.use-case'
import { ListMessagesUseCase } from './use-cases/ListMessages.use-case'
import { ListConversationDocumentsUseCase } from './use-cases/ListConversationDocuments.use-case'
import { ListCompanyDocumentsUseCase } from './use-cases/ListCompanyDocuments.use-case'
import { DeleteConversationUseCase } from './use-cases/DeleteConversation.use-case'
import { PurgeExpiredDocumentsUseCase } from './use-cases/PurgeExpiredDocuments.use-case'
import { DocumentRepository } from './repositories/DocumentRepository'
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
import { createSendMediaAction } from './flows/createSendMediaAction'
import { createSendProductListAction } from './flows/createSendProductListAction'
import { FlowMediaRepository } from './repositories/FlowMediaRepository'
import { WhatsAppChannelAdapter, type PreviewMediaSupport } from './channel/WhatsAppChannelAdapter'
import { ReceiveWebhookUseCase } from './channel/ReceiveWebhook.use-case'
import { IngestInboundMediaUseCase } from './channel/IngestInboundMedia.use-case'
import { verifyWebhookChallenge, type NonceStoreInterface } from './channel/webhookSecurity'
import { TranscribeAudioUseCase, type TranscribeAudioDependencies } from './use-cases/TranscribeAudio.use-case'
import { createTranscriptionPolicyResolver } from './use-cases/resolveTranscriptionPolicy'
import { StorePreviewMediaUseCase } from './use-cases/StorePreviewMedia.use-case'
import { TRANSCRIPTION_MODE, type AudioTranscriber, type TranscriptionMode } from './transcription.types'

export interface MetaWhatsAppModuleConfig {
  phoneNumberId: string
  accessToken: string
  webhookVerifyToken: string
  appSecret: string
  wabaId?: string
  apiVersion?: string
  // Aponta para um mock local em dev/teste; undefined usa a Graph API real.
  baseUrl?: string
  /**
   * Catálogo do Meta Commerce que a vitrine no chat oferece. Sem ele — ou sem `providers.catalog`
   * — a action `send_product_list` não é registrada: nó que o editor oferece e que em silêncio não
   * faz nada é pior do que nó que não existe.
   */
  catalogId?: string
}

export interface MetaWhatsAppModuleFeatures {
  // T4.4 — desliga o motor de grafo. Um produto cuja conversa é dirigida por código próprio
  // (o QuickCart tem o seu ConversationEngine) não deve nem carregar o interpretador, e o
  // módulo não pode presumir que todo consumidor quer fluxo visual.
  flowEngine?: boolean

  // Cache de leitura dos grafos. Desligado por omissão: cachear é decisão do host, que é quem
  // sabe se o Redis dele é compartilhado entre instâncias — cache por processo serviria versões
  // diferentes do mesmo fluxo depois de uma publicação. Ligar exige `providers.cache`; sem ele o
  // flag é ignorado, porque o módulo não abre conexão própria.
  flowGraphCache?: boolean | { ttlSeconds?: number }

  /**
   * Aceita mídia do simulador de conversa — o que faz o microfone aparecer no preview do cliente.
   *
   * **Desligado por omissão, e a decisão é consciente.** Ligado, o canal passa a aceitar id que não
   * veio da Meta: `preview-upload:<chave>` faz o servidor ler aquele objeto do storage. Em ambiente
   * de simulação isso é o recurso; em produção é leitura arbitrária do bucket por webhook forjado.
   *
   * Exige `providers.objectStorage` com `getObject` — sem os bytes não há o que devolver, e o flag é
   * ignorado em vez de produzir um canal que falha na primeira nota de voz.
   */
  previewMedia?: boolean
}

/**
 * Transcrição de áudio. Ausente = desligada, e as colunas ficam nulas ("não avaliado").
 *
 * `mode` é a decisão de produto que este objeto existe para carregar: `auto` transcreve toda nota de
 * voz recebida, na ingestão, onde o buffer já está em memória; `onDemand` só transcreve quando o
 * atendente pede, gastando cota apenas com áudio que alguém vai ler de fato.
 */
export interface MetaWhatsAppTranscriptionConfig {
  transcriber: AudioTranscriber
  /**
   * PADRÃO, não decisão final: vale para as empresas que não mexeram no interruptor do painel. As
   * configurações por empresa (`settings.transcriptionMode`) têm precedência.
   *
   * Padrão `onDemand` — o modo que não gasta cota sem alguém pedir.
   */
  mode?: TranscriptionMode
  /**
   * PADRÃO de ligado/desligado para empresas sem escolha registrada. `true` — injetar o transcritor
   * já é a declaração de que o host quer o recurso; quem controla por empresa usa o painel.
   */
  isEnabledByDefault?: boolean
  /** ISO 639-1 do produto (ex.: `'pt'`). Corta a detecção de idioma do engine. */
  languageHint?: string
}

export interface MetaWhatsAppModuleProviders {
  objectStorage?: ObjectStorageInterface
  // Cache do host, compartilhado entre instâncias (ver CacheInterface). Hoje serve os grafos de
  // fluxo, que são lidos a cada mensagem recebida.
  cache?: CacheInterface
  realtime?: RealtimeNotifierInterface
  subjectResolver?: SubjectResolverInterface
  // Opcional por desenho — sem catálogo injetado o módulo sobe e funciona, só os recursos de
  // produto ficam desligados (ver .specs/features/meta-catalog-trio/spec.md §4).
  catalog?: CatalogPort
  // Marca mensagem ofensiva do cliente no transcript. Injetado, e não construído aqui, pelo mesmo
  // motivo dos outros providers: a lista de termos e o liga/desliga são de cada produto, e o módulo
  // não lê process.env. Ausente, as colunas ficam nulas — "não avaliado".
  moderator?: MessageModerator
  /**
   * Converte nota de voz em texto. Exige `objectStorage` com `getObject` para o modo sob demanda —
   * transcrever um áudio já salvo significa ler os bytes de volta.
   */
  transcription?: MetaWhatsAppTranscriptionConfig
}

export interface CreateMetaWhatsAppModuleParams {
  db: MetaWhatsAppDatabase
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
  /**
   * Só monta o suporte quando as DUAS condições existem: o host pediu e o storage sabe ler de volta.
   * Ligar o flag sem storage legível daria um canal que aceita o id do simulador e falha ao buscar.
   */
  const previewMediaSupport =
    params.features?.previewMedia && providers.objectStorage?.getObject
      ? {
          isEnabled: true,
          objectStorage: providers.objectStorage as PreviewMediaSupport['objectStorage'],
        }
      : undefined

  const channel: ChannelAdapterInterface = new WhatsAppChannelAdapter(messageProvider, previewMediaSupport)

  const sessionRepository = new SessionRepository(db)
  const messageRepository = new MessageRepository(db)
  const settingsRepository = new SettingsRepository(db)
  const flowGraphCacheFeature = params.features?.flowGraphCache ?? false
  const flowGraphCache =
    flowGraphCacheFeature && providers.cache
      ? new FlowGraphCache(
          providers.cache,
          typeof flowGraphCacheFeature === 'object'
            ? (flowGraphCacheFeature.ttlSeconds ?? DEFAULT_FLOW_GRAPH_CACHE_TTL_SECONDS)
            : DEFAULT_FLOW_GRAPH_CACHE_TTL_SECONDS,
        )
      : undefined

  const flowGraphRepository = new FlowGraphRepository(db, flowGraphCache)
  const documentRepository = new DocumentRepository(db)
  const flowMediaRepository = new FlowMediaRepository(db)

  const logMessage = new LogMessageUseCase(
    sessionRepository,
    messageRepository,
    providers.realtime,
    providers.moderator,
  )
  const sendMessage = new SendMessageUseCase(
    channel,
    sessionRepository,
    logMessage,
    providers.objectStorage,
    documentRepository,
  )

  const receiveWebhook = new ReceiveWebhookUseCase({
    appSecret: config.appSecret,
    phoneNumberId: config.phoneNumberId,
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

  // `send_media` é a única action que o pacote registra sozinho — as demais dependem de regra do
  // produto. Condicionada a `getObject` porque sem os bytes o handler não teria o que enviar:
  // registrá-lo assim mesmo deixaria um nó que o editor oferece e que silenciosamente não faz nada.
  if (flowInterpreter && providers.objectStorage?.getObject) {
    flowInterpreter.registerFlowAction(
      FLOW_ACTION_KIND.SEND_MEDIA,
      createSendMediaAction({
        flowMediaRepository,
        objectStorage: providers.objectStorage as Parameters<typeof createSendMediaAction>[0]['objectStorage'],
        logMessage,
        startState,
        onError: hooks?.onFlowMediaError,
      }),
    )
  }

  // Vitrine no chat: precisa do catalogo injetado E do id do catalogo na Meta. Um sem o outro nao
  // envia nada — o `retailerId` so significa alguma coisa dentro de um catalogo.
  if (flowInterpreter && providers.catalog && config.catalogId) {
    flowInterpreter.registerFlowAction(
      FLOW_ACTION_KIND.SEND_PRODUCT_LIST,
      createSendProductListAction({
        catalog: providers.catalog,
        catalogId: config.catalogId,
        logMessage,
        startState,
        onError: hooks?.onFlowProductListError,
      }),
    )
  }

  const transcriptionMode = providers.transcription?.mode ?? TRANSCRIPTION_MODE.ON_DEMAND

  /**
   * Ambiente decide se é POSSÍVEL (o transcritor acima), settings decide se é para FAZER. Este
   * resolvedor junta os dois, a cada áudio, para o interruptor do painel valer sem deploy.
   */
  const resolveTranscriptionPolicy = providers.transcription
    ? createTranscriptionPolicyResolver({
        settingsRepository,
        defaults: {
          isEnabled: providers.transcription.isEnabledByDefault ?? true,
          mode: transcriptionMode,
        },
      })
    : undefined

  // Só existe com storage injetado — sem ele não há para onde copiar o binário, e devolver um
  // use-case que sempre falha seria pior do que a ausência ser visível no tipo.
  const ingestInboundMedia = providers.objectStorage
    ? new IngestInboundMediaUseCase(
        db,
        channel,
        providers.objectStorage,
        documentRepository,
        providers.transcription && resolveTranscriptionPolicy
          ? {
              transcriber: providers.transcription.transcriber,
              resolvePolicy: resolveTranscriptionPolicy,
              messageRepository,
              ...(providers.transcription.languageHint ? { languageHint: providers.transcription.languageHint } : {}),
              ...(hooks ? { hooks } : {}),
            }
          : undefined,
      )
    : undefined

  /**
   * Transcrição sob demanda e retomada de pendente. Exige `getObject`: transcrever um áudio já
   * salvo é ler os bytes de volta do storage, e sem esse método o use-case só saberia falhar —
   * a ausência no tipo é mais honesta que um botão que estoura no clique.
   *
   * O modo `auto` NÃO depende disto: ele transcreve dentro da ingestão, com o buffer que acabou de
   * baixar. Um host em `auto` sem `getObject` transcreve normalmente, só não oferece "transcrever
   * de novo".
   */
  const transcribeAudio =
    providers.transcription && providers.objectStorage?.getObject
      ? new TranscribeAudioUseCase({
          messageRepository,
          objectStorage: providers.objectStorage as TranscribeAudioDependencies['objectStorage'],
          transcriber: providers.transcription.transcriber,
          ...(resolveTranscriptionPolicy ? { resolvePolicy: resolveTranscriptionPolicy } : {}),
          ...(providers.transcription.languageHint ? { languageHint: providers.transcription.languageHint } : {}),
          ...(hooks ? { hooks } : {}),
        })
      : undefined

  /**
   * A leitura da biblioteca existe mesmo sem storage injetado: listar é consultar a tabela, e
   * devolver `undefined` aqui obrigaria o host a ramificar numa rota que funciona de qualquer jeito.
   * Quem precisa de storage é o download (URL assinada) — esse fica com o host, que já tem o
   * provider em mãos.
   */
  const listDocuments = new ListConversationDocumentsUseCase(sessionRepository, documentRepository)

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
      listDocuments,
      // Biblioteca da empresa inteira, para uma tela de Documentos fora da conversa.
      listCompanyDocuments: new ListCompanyDocumentsUseCase(documentRepository),
      // Apaga a mídia no storage antes das linhas — a cascata da FK sozinha deixaria os binários
      // órfãos, já que a lista de uploadId vive justamente nas linhas que ela derruba.
      delete: new DeleteConversationUseCase(sessionRepository, documentRepository, providers.objectStorage),
      purgeExpiredDocuments: new PurgeExpiredDocumentsUseCase(documentRepository, providers.objectStorage),
      export: new ExportConversationUseCase(sessionRepository),
      // undefined quando transcrição não foi injetada, ou quando o storage não sabe ler de volta.
      // O painel consulta a ausência para decidir se desenha o botão "transcrever".
      transcribeAudio,
      repository: sessionRepository,
      messageRepository,
      documentRepository,
    },
    /**
     * `undefined` = o host não injetou transcritor, e nenhuma configuração de empresa muda isso: a
     * capacidade não existe. Presente, `resolvePolicy` responde o que vale para uma empresa —
     * é o que a rota de configurações usa para dizer ao painel se desenha o interruptor.
     */
    transcription:
      providers.transcription && resolveTranscriptionPolicy
        ? { defaultMode: transcriptionMode, resolvePolicy: resolveTranscriptionPolicy }
        : undefined,
    settings: settingsRepository,
    /**
     * `undefined` quando o recurso não está ligado (ou falta storage legível). O host consulta a
     * ausência para não registrar a rota de upload — e o preview, sem a rota, esconde o microfone.
     */
    previewMedia: previewMediaSupport
      ? new StorePreviewMediaUseCase(
          providers.objectStorage!,
          () => `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        )
      : undefined,
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
          // Biblioteca de mídia dos nós `send_media` — o host liga nas rotas do editor
          // (anexar/reordenar/desligar). Existe mesmo sem storage injetado: gerenciar anexos é
          // consultar a tabela, e só o ENVIO precisa dos bytes.
          mediaRepository: flowMediaRepository,
        }
      : undefined,
    catalog: providers.catalog,
  }
}

export type MetaWhatsAppModule = ReturnType<typeof createMetaWhatsAppModule>
