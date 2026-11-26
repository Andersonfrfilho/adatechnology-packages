/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import {
  createFromTemplateSchema,
  createPostSchema,
  createRecurrenceSchema,
  DEFAULT_ADMIN_SCOPES,
  listPostsQuerySchema,
  publishPostSchema,
  republishPostSchema,
  saveAsTemplateSchema,
  updatePostSchema,
  updateRecurrenceSchema,
  type CreateFromTemplateInput,
  type CreatePostInput,
  type CreateRecurrenceInput,
  type ListPostsQuery,
  type PublishPostInput,
  type RepublishPostInput,
  type SaveAsTemplateInput,
  type UpdatePostInput,
  type UpdateRecurrenceInput,
} from '@adatechnology/content-contracts'
import type { ModuleRoute, RequestContext } from '@adatechnology/module-http'

import type { ContentModule } from '../ContentModule'
import { TAG_SCOPE } from '../use-cases/PublicPost.use-cases'
import { requireCompany } from './requireCompany'

function reference(context: RequestContext): { companyId: string; id: string } {
  return { companyId: requireCompany(context), id: context.params.id ?? '' }
}

const json = (status: number, data: unknown) => ({ kind: 'json' as const, status, body: { data } })

export function buildAdminRoutes(module: ContentModule): ModuleRoute[] {
  const { useCases } = module
  const requiredScopes = module.config.adminScopes ?? DEFAULT_ADMIN_SCOPES
  const admin = { scope: 'admin' as const, requiredScopes }

  const uploadRoutes: ModuleRoute[] = useCases.uploadCoverImage
    ? [
        {
          ...admin,
          method: 'POST',
          path: '/posts/cover-images',
          operationId: 'uploadPostCoverImage',
          summary: 'Envia a imagem de capa (bytes crus, Content-Type jpeg/png/webp) e devolve a URL',
          async handler(context) {
            const upload = useCases.uploadCoverImage
            if (!upload) return { kind: 'empty', status: 404 }
            const result = await upload.execute({
              companyId: requireCompany(context),
              bytes: context.rawBody ?? new Uint8Array(),
              mimeType: context.headers['content-type'] ?? '',
            })
            return json(201, result)
          },
        },
      ]
    : []

  return [
    {
      ...admin,
      method: 'GET',
      path: '/posts',
      querySchema: listPostsQuerySchema,
      operationId: 'listPosts',
      summary: 'Lista posts da empresa (todos os status), com filtro por status, tag e busca',
      async handler(context) {
        const result = await useCases.listPosts.execute({
          companyId: requireCompany(context),
          ...(context.query as unknown as ListPostsQuery),
        })
        return { kind: 'json', status: 200, body: result }
      },
    },
    {
      ...admin,
      method: 'POST',
      path: '/posts',
      bodySchema: createPostSchema,
      operationId: 'createPost',
      summary: 'Cria um post como rascunho; sem slug, gera a partir do título',
      async handler(context) {
        const post = await useCases.createPost.execute({
          companyId: requireCompany(context),
          input: context.body as CreatePostInput,
        })
        return json(201, post)
      },
    },
    // Antes de `/posts/:id`: `findRoute` para na primeira rota que casa, e `:id` casaria "tags".
    {
      ...admin,
      method: 'GET',
      path: '/posts/tags',
      operationId: 'listPostTags',
      summary: 'Tags usadas em qualquer post da empresa, com contagem',
      async handler(context) {
        return json(
          200,
          await useCases.listTags.execute({ companyId: requireCompany(context), scope: TAG_SCOPE.ADMIN }),
        )
      },
    },
    {
      ...admin,
      method: 'GET',
      path: '/posts/counts',
      operationId: 'countPosts',
      summary: 'Contagem de posts por aba: publicados, agendados, rascunhos, arquivados e modelos',
      async handler(context) {
        return json(200, await useCases.countPosts.execute({ companyId: requireCompany(context) }))
      },
    },
    ...recurrenceRoutes(module),
    ...uploadRoutes,
    {
      ...admin,
      method: 'GET',
      path: '/posts/:id',
      operationId: 'getPost',
      summary: 'Lê um post da empresa (qualquer status)',
      async handler(context) {
        return json(200, await useCases.getPost.execute(reference(context)))
      },
    },
    {
      ...admin,
      method: 'PATCH',
      path: '/posts/:id',
      bodySchema: updatePostSchema,
      operationId: 'updatePost',
      summary: 'Atualiza campos de um post; trocar o título não troca o slug',
      async handler(context) {
        return json(
          200,
          await useCases.updatePost.execute({ ...reference(context), input: context.body as UpdatePostInput }),
        )
      },
    },
    {
      ...admin,
      method: 'DELETE',
      path: '/posts/:id',
      operationId: 'archivePost',
      summary: 'Arquiva o post: sai do site, conteúdo e slug continuam guardados',
      async handler(context) {
        await useCases.archivePost.execute(reference(context))
        return { kind: 'empty', status: 204 }
      },
    },
    {
      ...admin,
      method: 'POST',
      path: '/posts/:id/publish',
      // Opcional: `POST /publish` sem corpo publica agora.
      bodySchema: publishPostSchema.optional(),
      operationId: 'publishPost',
      summary: 'Publica agora, ou agenda quando `publishedAt` é futuro',
      async handler(context) {
        return json(
          200,
          await useCases.publishPost.execute({
            ...reference(context),
            input: (context.body ?? {}) as PublishPostInput,
          }),
        )
      },
    },
    {
      ...admin,
      method: 'POST',
      path: '/posts/:id/unpublish',
      operationId: 'unpublishPost',
      summary: 'Tira do ar (ou cancela o agendamento) e volta a rascunho',
      async handler(context) {
        return json(200, await useCases.unpublishPost.execute(reference(context)))
      },
    },
    {
      ...admin,
      method: 'POST',
      path: '/posts/:id/republish',
      bodySchema: republishPostSchema.optional(),
      operationId: 'republishPost',
      summary: 'Republica um post no ar com nova data, mantendo o mesmo endereço (SEO); data futura é recusada',
      async handler(context) {
        return json(
          200,
          await useCases.republishPost.execute({
            ...reference(context),
            input: (context.body ?? {}) as RepublishPostInput,
          }),
        )
      },
    },
    {
      ...admin,
      method: 'POST',
      path: '/posts/:id/save-as-template',
      bodySchema: saveAsTemplateSchema.optional(),
      operationId: 'savePostAsTemplate',
      summary: 'Copia o post para um modelo (o original não muda)',
      async handler(context) {
        return json(
          201,
          await useCases.saveAsTemplate.execute({
            ...reference(context),
            input: (context.body ?? {}) as SaveAsTemplateInput,
          }),
        )
      },
    },
    {
      ...admin,
      method: 'POST',
      path: '/posts/:id/from-template',
      bodySchema: createFromTemplateSchema.optional(),
      operationId: 'createPostFromTemplate',
      summary: 'Cria um rascunho novo a partir do modelo `:id`',
      async handler(context) {
        return json(
          201,
          await useCases.createFromTemplate.execute({
            ...reference(context),
            input: (context.body ?? {}) as CreateFromTemplateInput,
          }),
        )
      },
    },
  ]
}

function recurrenceRoutes(module: ContentModule): ModuleRoute[] {
  const { useCases } = module
  const admin = { scope: 'admin' as const, requiredScopes: module.config.adminScopes ?? DEFAULT_ADMIN_SCOPES }
  return [
    {
      ...admin,
      method: 'GET',
      path: '/recurrences',
      operationId: 'listRecurrences',
      summary: 'Regras de recorrência da empresa',
      async handler(context) {
        return json(200, await useCases.listRecurrences.execute({ companyId: requireCompany(context) }))
      },
    },
    {
      ...admin,
      method: 'POST',
      path: '/recurrences',
      bodySchema: createRecurrenceSchema,
      operationId: 'createRecurrence',
      summary: 'Cria regra: publica um post novo, copiado do modelo, toda semana ou todo mês',
      async handler(context) {
        return json(
          201,
          await useCases.createRecurrence.execute({
            companyId: requireCompany(context),
            input: context.body as CreateRecurrenceInput,
          }),
        )
      },
    },
    {
      ...admin,
      method: 'PATCH',
      path: '/recurrences/:id',
      bodySchema: updateRecurrenceSchema,
      operationId: 'updateRecurrence',
      summary: 'Pausa, retoma ou remarca a próxima execução',
      async handler(context) {
        return json(
          200,
          await useCases.updateRecurrence.execute({
            ...reference(context),
            input: context.body as UpdateRecurrenceInput,
          }),
        )
      },
    },
    {
      ...admin,
      method: 'DELETE',
      path: '/recurrences/:id',
      operationId: 'removeRecurrence',
      summary: 'Apaga a regra; os posts já publicados por ela continuam no ar',
      async handler(context) {
        await useCases.removeRecurrence.execute(reference(context))
        return { kind: 'empty', status: 204 }
      },
    },
  ]
}
