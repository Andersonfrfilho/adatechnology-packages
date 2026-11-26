import {
  QuickReplyNotFoundError,
  MetaWhatsAppError,
  META_WHATSAPP_ERROR_CODES,
  listWhatsAppQuickRepliesQuerySchema,
  whatsAppQuickReplyInputSchema,
  type ListWhatsAppQuickRepliesQuery,
  type WhatsAppQuickReplyInput,
} from '@adatechnology/meta-whatsapp-contracts'
import { HTTP_METHOD, ROUTE_SCOPE } from '@adatechnology/module-http'
import type { ModuleRoute, ModuleRouteTable, RequestContext } from '@adatechnology/module-http'
import type { MetaWhatsAppModule } from '../createMetaWhatsAppModule'
import { DEFAULT_QUICK_REPLY_WRITE_SCOPES, type QuickReplyRouteScopes } from './quickReplyScope.constant'

export type CreateMetaWhatsAppQuickReplyRoutesParams = {
  readonly module: Pick<MetaWhatsAppModule, 'quickReplies'>
  readonly scopes?: QuickReplyRouteScopes
}

/** `dispatchRoute` já recusa requisição sem identidade; isto só garante o tipo para o handler. */
function requireCompany(context: RequestContext): string {
  if (!context.auth?.companyId) {
    throw new MetaWhatsAppError('Rota exige contexto autenticado.', 401, META_WHATSAPP_ERROR_CODES.CONFIG_MISSING)
  }
  return context.auth.companyId
}

function requireId(context: RequestContext): string {
  const id = context.params.id
  if (!id) throw new QuickReplyNotFoundError('')
  return id
}

/**
 * Tabela de rotas de respostas rápidas (`module-http`). O host escolhe o adaptador (`fetch` ou
 * uWebSockets) e o prefixo; o `companyId` vem sempre da identidade, nunca do corpo.
 *
 * - `GET    /quick-replies`      agente autenticado; `?search=` filtra título, atalho e texto
 * - `POST   /quick-replies`      escopo de escrita; `201`
 * - `PUT    /quick-replies/:id`  escopo de escrita; troca título, atalho e texto
 * - `DELETE /quick-replies/:id`  escopo de escrita; `204`
 */
export function createMetaWhatsAppQuickReplyRoutes(params: CreateMetaWhatsAppQuickReplyRoutesParams): ModuleRouteTable {
  const { list, create, update, delete: remove } = params.module.quickReplies
  const write = { scope: ROUTE_SCOPE.ADMIN, requiredScopes: params.scopes?.write ?? DEFAULT_QUICK_REPLY_WRITE_SCOPES }
  const read = {
    scope: ROUTE_SCOPE.USER,
    ...(params.scopes?.read?.length ? { requiredScopes: params.scopes.read } : {}),
  }

  const routes: ModuleRoute[] = [
    {
      ...read,
      method: HTTP_METHOD.GET,
      path: '/quick-replies',
      querySchema: listWhatsAppQuickRepliesQuerySchema,
      operationId: 'listWhatsAppQuickReplies',
      summary: 'Lista as respostas rápidas da empresa, na ordem de exibição',
      async handler(context) {
        const query = context.query as unknown as ListWhatsAppQuickRepliesQuery
        const data = await list.execute({ companyId: requireCompany(context), ...query })
        return { kind: 'json', status: 200, body: { data } }
      },
    },
    {
      ...write,
      method: HTTP_METHOD.POST,
      path: '/quick-replies',
      bodySchema: whatsAppQuickReplyInputSchema,
      operationId: 'createWhatsAppQuickReply',
      summary: 'Cria uma resposta rápida (atalho único por empresa)',
      async handler(context) {
        const input = context.body as WhatsAppQuickReplyInput
        const data = await create.execute({ ...input, companyId: requireCompany(context) })
        return { kind: 'json', status: 201, body: { data } }
      },
    },
    {
      ...write,
      method: HTTP_METHOD.PUT,
      path: '/quick-replies/:id',
      bodySchema: whatsAppQuickReplyInputSchema,
      operationId: 'updateWhatsAppQuickReply',
      summary: 'Substitui título, atalho e texto de uma resposta rápida',
      async handler(context) {
        const input = context.body as WhatsAppQuickReplyInput
        const data = await update.execute({ ...input, companyId: requireCompany(context), id: requireId(context) })
        return { kind: 'json', status: 200, body: { data } }
      },
    },
    {
      ...write,
      method: HTTP_METHOD.DELETE,
      path: '/quick-replies/:id',
      operationId: 'deleteWhatsAppQuickReply',
      summary: 'Apaga uma resposta rápida',
      async handler(context) {
        await remove.execute({ companyId: requireCompany(context), id: requireId(context) })
        return { kind: 'empty', status: 204 }
      },
    },
  ]
  return routes
}
