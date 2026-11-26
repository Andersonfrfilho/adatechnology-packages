/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Porta de respostas rápidas pronta para as rotas de `createMetaWhatsAppQuickReplyRoutes`
 * (`@adatechnology/meta-whatsapp-module`). O resultado se espalha em `ConversationsApi` e satisfaz
 * `QuickRepliesWorkspaceApi`; sem ele cada host reescrevia a mesma ponte — e errava o envelope.
 *
 * Só texto: anexos de resposta rápida não existem no módulo, então não há `uploadQuickReplyAttachment`
 * e as telas não oferecem a seção de anexos.
 */

import type { QuickReply, QuickReplyInput } from './quickReply.types'

export type CreateMetaWhatsAppQuickRepliesClientParams = {
  /** Onde o host montou as rotas, ex.: `/v1/whatsapp`. Sem barra no fim; `/quick-replies` é acrescentado. */
  readonly baseUrl: string
  /** Cabeçalhos por requisição (o `Authorization` do host). Chamado a cada request. */
  readonly getHeaders?: () => Record<string, string> | Promise<Record<string, string>>
  readonly fetch?: typeof fetch
}

export type MetaWhatsAppQuickRepliesClient = {
  readonly listQuickReplies: (params?: { search?: string }) => Promise<QuickReply[]>
  readonly createQuickReply: (input: QuickReplyInput) => Promise<QuickReply>
  readonly updateQuickReply: (id: string, input: QuickReplyInput) => Promise<QuickReply>
  readonly deleteQuickReply: (id: string) => Promise<void>
}

export type QuickRepliesApiErrorDetail = { readonly field: string; readonly message: string }

/**
 * Erro da API com `code` estável e `details` no formato que o `QuickRepliesWorkspace` lê
 * (`{ field, message }`): a validação do módulo devolve `issues[{ path, message }]`, traduzido aqui
 * para o erro aparecer no campo certo do formulário.
 */
export class QuickRepliesApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
    readonly details: readonly QuickRepliesApiErrorDetail[] = [],
  ) {
    super(message)
    this.name = 'QuickRepliesApiError'
  }
}

type ErrorBody = {
  readonly error?: {
    readonly code?: string
    readonly message?: string
    readonly issues?: readonly { readonly path?: string; readonly message?: string }[]
  }
}

async function toApiError(response: Response): Promise<QuickRepliesApiError> {
  const body = (await response.json().catch(() => undefined)) as ErrorBody | undefined
  const details = (body?.error?.issues ?? []).flatMap((issue) =>
    issue.path && issue.message ? [{ field: issue.path, message: issue.message }] : [],
  )
  return new QuickRepliesApiError(
    body?.error?.message ?? `Falha na API de respostas rápidas (${response.status})`,
    response.status,
    body?.error?.code ?? 'HTTP_ERROR',
    details,
  )
}

// Só o que o módulo aceita — `attachmentUploadIds` e afins ficam de fora do corpo.
function toBody(input: QuickReplyInput): Pick<QuickReplyInput, 'title' | 'shortcut' | 'body'> {
  return { title: input.title, shortcut: input.shortcut, body: input.body }
}

export function createMetaWhatsAppQuickRepliesClient(
  params: CreateMetaWhatsAppQuickRepliesClientParams,
): MetaWhatsAppQuickRepliesClient {
  const fetchImpl = params.fetch ?? globalThis.fetch.bind(globalThis)
  const collectionUrl = `${params.baseUrl}/quick-replies`

  async function request(url: string, method: string, json?: unknown): Promise<Response> {
    const headers: Record<string, string> = { ...(await params.getHeaders?.()) }
    if (json !== undefined) headers['content-type'] = 'application/json'
    const response = await fetchImpl(url, {
      method,
      headers,
      ...(json === undefined ? {} : { body: JSON.stringify(json) }),
    })
    if (!response.ok) throw await toApiError(response)
    return response
  }

  async function requestData<TResult>(url: string, method: string, json?: unknown): Promise<TResult> {
    const response = await request(url, method, json)
    return ((await response.json()) as { data: TResult }).data
  }

  const itemUrl = (id: string): string => `${collectionUrl}/${encodeURIComponent(id)}`

  return {
    listQuickReplies: (listParams) => {
      const search = listParams?.search?.trim()
      const query = search ? `?${new URLSearchParams({ search }).toString()}` : ''
      return requestData<QuickReply[]>(`${collectionUrl}${query}`, 'GET')
    },
    createQuickReply: (input) => requestData<QuickReply>(collectionUrl, 'POST', toBody(input)),
    updateQuickReply: (id, input) => requestData<QuickReply>(itemUrl(id), 'PUT', toBody(input)),
    deleteQuickReply: async (id) => {
      await request(itemUrl(id), 'DELETE')
    },
  }
}
