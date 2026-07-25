/**
 * Example de uso do @adatechnology/meta-whatsapp-module — schema, migrations e use-cases de
 * conversa/sessão (Fase 3: schema Postgres, repositórios, takeover/release, listagem, export,
 * isolamento multiempresa) + grafo de fluxo (Fase 4: CRUD com lock otimista, interpretador com
 * actions registráveis pelo host, posições ao vivo) + canal (Fase 5: webhook assinado com
 * anti-replay, envio com janela de 24h, settings por empresa, factory do módulo).
 *
 * Rodar: bun run packages/backend/meta-whatsapp-module/example/index.ts
 * Requer DATABASE_URL apontando para um Postgres real (o exemplo roda as migrations do módulo
 * nele — use um banco descartável, não o de produção).
 *
 * Subir um Postgres descartável rapidamente:
 *   docker run -d -e POSTGRES_PASSWORD=test -e POSTGRES_DB=test -p 15432:5432 postgres:16-alpine
 *   DATABASE_URL=postgres://postgres:test@localhost:15432/test bun run example/index.ts
 */
import { createHmac } from 'node:crypto'
import { SQL } from 'bun'
import { drizzle } from 'drizzle-orm/bun-sql'
import {
  createMetaWhatsAppModule,
  type NonceStoreInterface,
  runMetaWhatsAppMigrations,
  SessionRepository,
  MessageRepository,
  LogMessageUseCase,
  TakeoverConversationUseCase,
  ReleaseConversationUseCase,
  ListConversationsUseCase,
  ExportConversationUseCase,
  FlowGraphRepository,
  FlowInterpreter,
  CreateFlowGraphUseCase,
  GetLiveFlowPositionsUseCase,
} from '../src/index'
import type { ChannelAdapterInterface, ConversationSession } from '@adatechnology/meta-whatsapp-contracts'

const databaseUrl = process.env['DATABASE_URL']
if (!databaseUrl) {
  console.log('Defina DATABASE_URL (postgres://...) para rodar o exemplo — ver instruções no topo deste arquivo.')
  process.exit(0)
}

const client = new SQL(databaseUrl)
const db = drizzle({ client })

async function main() {
  console.log('Aplicando migrations do módulo (schema meta_whatsapp)...')
  await runMetaWhatsAppMigrations(db)

  const sessionRepository = new SessionRepository(db)
  const messageRepository = new MessageRepository(db)

  // Cada operação recebe companyId explicitamente — o host resolve isso do contexto
  // autenticado, nunca de um campo livre do payload (ver database.md).
  const companyId = '11111111-1111-1111-1111-111111111111'
  const whatsappNumber = '5511988887777'

  const logMessage = new LogMessageUseCase(sessionRepository, messageRepository)
  const takeover = new TakeoverConversationUseCase(sessionRepository)
  const release = new ReleaseConversationUseCase(sessionRepository)
  const listConversations = new ListConversationsUseCase(sessionRepository)
  const exportConversation = new ExportConversationUseCase(sessionRepository)

  console.log('\n1. Mensagem inbound chega pelo webhook — cria a sessão automaticamente:')
  const message = await logMessage.execute({
    companyId,
    whatsappNumber,
    direction: 'inbound',
    sender: 'customer',
    type: 'text',
    content: 'Olá, quero saber o preço',
    startState: 'start',
  })
  console.log('   Mensagem registrada:', message?.id)

  console.log('\n2. Atendente assume a conversa (takeover):')
  await takeover.execute({ companyId, whatsappNumber, agentUserId: '22222222-2222-2222-2222-222222222222' })
  console.log('   Sessão agora em modo human.')

  console.log('\n3. Inbox do host lista as conversas aguardando/atribuídas:')
  const conversations = await listConversations.execute({ companyId })
  console.log('  ', conversations.map((c) => `${c.whatsappNumber} — ${c.mode}`).join(', '))

  console.log('\n4. Atendente devolve a conversa ao bot (release):')
  await release.execute({ companyId, whatsappNumber })

  console.log('\n5. Export do transcript completo (ex.: anexar num chamado):')
  const exported = await exportConversation.execute({ companyId, whatsappNumber })
  console.log(`   ${exported.messages.length} mensagem(ns) na sessão ${exported.session.id}`)

  console.log('\n5b. Janela de 24h — carimbada pela mensagem do cliente (não por ação do atendente):')
  const hoursSinceInbound = await sessionRepository.hoursSinceLastInbound(companyId, whatsappNumber)
  console.log(`   ${hoursSinceInbound?.toFixed(2)}h desde a última mensagem do cliente`)
  console.log(
    `   ${hoursSinceInbound !== undefined && hoursSinceInbound < 24 ? 'Dentro' : 'Fora'} da janela — ${hoursSinceInbound !== undefined && hoursSinceInbound < 24 ? 'pode enviar mensagem livre' : 'só template aprovado reabre'}`,
  )

  console.log('\n--- Fase 4: grafo de fluxo ---')

  const flowGraphRepository = new FlowGraphRepository(db)
  const createFlow = new CreateFlowGraphUseCase(flowGraphRepository)
  const getLivePositions = new GetLiveFlowPositionsUseCase(flowGraphRepository)

  console.log('\n6. Criando um grafo simples (pergunta → ação):')
  const graph = await createFlow.execute({
    companyId,
    key: 'example-flow',
    label: 'Fluxo de exemplo',
    startNodeId: 'ask_name',
    nodes: {
      ask_name: { id: 'ask_name', type: 'question', contextKey: 'name', question: 'Qual seu nome?', next: 'handoff' },
      // 'handoff' é um kind genérico que o pacote já conhece (BUILT_IN_ACTION_KINDS) — um
      // actionKind como 'trigger_simulation' do bot seria registrado pelo host, não pelo pacote.
      handoff: { id: 'handoff', type: 'action', actionKind: 'handoff' },
    },
  })

  console.log('\n7. Interpretador processa o fluxo — o host registra o que "handoff" faz:')
  const interpreter = new FlowInterpreter()
  interpreter.registerFlowAction('handoff', async ({ session }) => {
    console.log(`   [host] encaminhando ${session.whatsappNumber} para atendimento humano`)
  })

  const channelStub: ChannelAdapterInterface = {
    sendText: async () => ({ externalMessageId: null }),
    sendMedia: async () => ({ externalMessageId: null }),
    sendTemplate: async () => ({ externalMessageId: null }),
    sendInteractiveList: async () => ({ externalMessageId: null }),
    fetchMediaAsBase64: async () => ({ data: '', mimeType: '' }),
  }
  const sessionForFlow: ConversationSession = {
    id: 'example-session',
    companyId,
    whatsappNumber,
    currentState: 'example-flow:ask_name',
    context: {},
    mode: 'bot',
    assignedUserId: null,
    humanRequestedAt: null,
    lastInboundAt: null,
    lastAgentReadAt: null,
    lastActivity: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  const answered = await interpreter.step({
    graph,
    currentNodeId: 'ask_name',
    userAnswer: 'Maria',
    context: {},
    session: sessionForFlow,
    channel: channelStub,
  })
  console.log(
    '   Após responder "Maria":',
    answered.kind,
    '→ próximo nó:',
    'nodeId' in answered ? answered.nodeId : '-',
  )

  if (answered.kind === 'advanced') {
    const final = await interpreter.step({
      graph,
      currentNodeId: answered.nodeId,
      context: answered.context,
      session: sessionForFlow,
      channel: channelStub,
    })
    console.log('   Após a ação:', final.kind)
  }

  console.log('\n8. Posições ao vivo — o host grava a posição a cada transição do interpretador:')
  await sessionRepository.setFlowPosition(companyId, whatsappNumber, graph.key, 'ask_name')
  const positions = await getLivePositions.execute({ companyId })
  console.log('  ', positions)

  console.log('\n--- Fase 5: canal (webhook, envio, settings) via createMetaWhatsAppModule ---')

  // Tudo que é ambiente entra por parâmetro — o módulo não lê process.env nem abre conexão.
  const whatsapp = createMetaWhatsAppModule({
    db,
    config: {
      phoneNumberId: process.env['WHATSAPP_PHONE_NUMBER_ID'] ?? 'phone-number-id',
      accessToken: process.env['WHATSAPP_ACCESS_TOKEN'] ?? 'access-token',
      webhookVerifyToken: 'verify-token-de-exemplo',
      appSecret: 'app-secret-de-exemplo',
    },
    // Em produção use um cache compartilhado (Redis) — o anti-replay precisa valer entre
    // todas as instâncias, senão a mesma entrega passa uma vez em cada uma.
    nonceStore: createInMemoryNonceStore(),
    hooks: {
      // Único ponto onde a regra de negócio do produto entra.
      async onMessageReceived(message) {
        console.log(`   [host] recebeu "${message.text?.body ?? message.type}" de ${message.from}`)
        return { outcome: 'continue' }
      },
    },
  })

  console.log('\n9. Verificação do webhook (GET que a Meta faz ao cadastrar a URL):')
  const challenge = whatsapp.webhook.verifyChallenge({
    mode: 'subscribe',
    token: 'verify-token-de-exemplo',
    challenge: 'desafio-123',
  })
  console.log('   Devolve o challenge:', challenge)

  console.log('\n10. Entrega assinada do webhook (POST) — e o replay dela:')
  const inboundBody = JSON.stringify({
    object: 'whatsapp_business_account',
    entry: [
      {
        id: 'entry-1',
        changes: [
          {
            value: {
              messaging_product: 'whatsapp',
              messages: [
                {
                  id: 'wamid.EXEMPLO',
                  from: whatsappNumber,
                  type: 'text',
                  text: { body: 'Mensagem vinda do webhook' },
                  timestamp: '1700000000',
                },
              ],
            },
          },
        ],
      },
    ],
  })
  const signature = 'sha256=' + createHmac('sha256', 'app-secret-de-exemplo').update(inboundBody).digest('hex')

  const first = await whatsapp.webhook.receive.execute({ companyId, rawBody: inboundBody, signatureHeader: signature })
  console.log('   1ª entrega:', first)
  const replay = await whatsapp.webhook.receive.execute({ companyId, rawBody: inboundBody, signatureHeader: signature })
  console.log('   Replay:', replay, '← ignorado, sem reprocessar a regra de negócio')

  console.log('\n11. Configuração de WhatsApp da empresa (tabela do módulo, não do host):')
  await whatsapp.settings.save(companyId, {
    templateName: 'reengajamento_cliente',
    templateVariables: ['{clientName}', '{city}'],
  })
  const resolvedVariables = await whatsapp.settings.resolveTemplateVariables(companyId, {
    clientName: 'Ana',
    city: 'Recife',
  })
  console.log('   Variáveis do template resolvidas na ordem {{1}},{{2}}:', resolvedVariables)

  console.log('\n12. Motor de fluxo desligável (features.flowEngine):')
  const semFluxo = createMetaWhatsAppModule({
    db,
    config: { phoneNumberId: 'p', accessToken: 't', webhookVerifyToken: 'v', appSecret: 's' },
    nonceStore: createInMemoryNonceStore(),
    features: { flowEngine: false },
  })
  console.log('   flows:', semFluxo.flows, '← ausente; conversas e webhook seguem funcionando')
}

// Só para o exemplo rodar sozinho: em produção isto é Redis (SET NX + TTL), compartilhado
// entre instâncias.
function createInMemoryNonceStore(): NonceStoreInterface {
  const seen = new Set<string>()
  return {
    async setIfAbsent(key: string) {
      if (seen.has(key)) return false
      seen.add(key)
      return true
    },
  }
}

main()
  .catch((error) => {
    console.error('Erro:', error)
    process.exitCode = 1
  })
  .finally(() => client.close())
