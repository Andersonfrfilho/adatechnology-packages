/**
 * Example de uso do @adatechnology/meta-whatsapp-module — schema, migrations e use-cases de
 * conversa/sessão (Fase 3: schema Postgres, repositórios, takeover/release, listagem, export,
 * isolamento multiempresa).
 *
 * Rodar: bun run packages/backend/meta-whatsapp-module/example/index.ts
 * Requer DATABASE_URL apontando para um Postgres real (o exemplo roda as migrations do módulo
 * nele — use um banco descartável, não o de produção).
 *
 * Subir um Postgres descartável rapidamente:
 *   docker run -d -e POSTGRES_PASSWORD=test -e POSTGRES_DB=test -p 15432:5432 postgres:16-alpine
 *   DATABASE_URL=postgres://postgres:test@localhost:15432/test bun run example/index.ts
 */
import { SQL } from 'bun'
import { drizzle } from 'drizzle-orm/bun-sql'
import {
  runMetaWhatsAppMigrations,
  SessionRepository,
  MessageRepository,
  LogMessageUseCase,
  TakeoverConversationUseCase,
  ReleaseConversationUseCase,
  ListConversationsUseCase,
  ExportConversationUseCase,
} from '../src/index'

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
}

main()
  .catch((error) => {
    console.error('Erro:', error)
    process.exitCode = 1
  })
  .finally(() => client.close())
