/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'
import { randomUUID } from 'node:crypto'
import { CONTENT_ERROR_CODES, POST_EVENT, POST_STATUS, type PostChangedEvent } from '@adatechnology/content-contracts'

import { buildTestModule } from '../testing/buildTestModule'

const COMPANY_A = randomUUID()
const COMPANY_B = randomUUID()

describe('criar e editar', () => {
  it('cria rascunho com slug gerado do título e tempo de leitura', async () => {
    const { module } = buildTestModule()
    const post = await module.useCases.createPost.execute({
      companyId: COMPANY_A,
      input: { title: 'Promoção de Verão!', body: 'palavra '.repeat(450), tags: ['Dicas', 'dicas '] },
    })
    expect(post.status).toBe(POST_STATUS.DRAFT)
    expect(post.slug).toBe('promocao-de-verao')
    expect(post.readingTimeMinutes).toBe(3)
    expect(post.tags).toEqual(['dicas'])
    expect(post.publishedAt).toBeNull()
  })

  it('slug repetido ganha sufixo; slug informado repetido é 409', async () => {
    const { module } = buildTestModule()
    const create = module.useCases.createPost
    await create.execute({ companyId: COMPANY_A, input: { title: 'Novidade' } })
    const second = await create.execute({ companyId: COMPANY_A, input: { title: 'Novidade' } })
    expect(second.slug).toBe('novidade-2')

    await expect(
      create.execute({ companyId: COMPANY_A, input: { title: 'X', slug: 'novidade' } }),
    ).rejects.toMatchObject({
      code: CONTENT_ERROR_CODES.DUPLICATE_SLUG,
      statusCode: 409,
    })
  })

  it('o mesmo slug é livre em outra empresa', async () => {
    const { module } = buildTestModule()
    await module.useCases.createPost.execute({ companyId: COMPANY_A, input: { title: 'Novidade' } })
    const other = await module.useCases.createPost.execute({ companyId: COMPANY_B, input: { title: 'Novidade' } })
    expect(other.slug).toBe('novidade')
  })

  it('título sem caractere latino cai no slug padrão', async () => {
    const { module } = buildTestModule()
    const post = await module.useCases.createPost.execute({ companyId: COMPANY_A, input: { title: '🎉' } })
    expect(post.slug).toBe('post')
  })

  it('editar o título não muda o slug; editar o slug valida duplicidade', async () => {
    const { module } = buildTestModule()
    const { createPost, updatePost } = module.useCases
    const first = await createPost.execute({ companyId: COMPANY_A, input: { title: 'Primeiro' } })
    await createPost.execute({ companyId: COMPANY_A, input: { title: 'Segundo' } })

    const renamed = await updatePost.execute({ companyId: COMPANY_A, id: first.id, input: { title: 'Outro título' } })
    expect(renamed.slug).toBe('primeiro')

    await expect(
      updatePost.execute({ companyId: COMPANY_A, id: first.id, input: { slug: 'segundo' } }),
    ).rejects.toMatchObject({ code: CONTENT_ERROR_CODES.DUPLICATE_SLUG })

    const reslugged = await updatePost.execute({
      companyId: COMPANY_A,
      id: first.id,
      input: { slug: 'novo-endereco', body: 'a b c' },
    })
    expect(reslugged.slug).toBe('novo-endereco')
  })

  it('valida a entrada mesmo chamado sem a rota', async () => {
    const { module } = buildTestModule()
    await expect(
      module.useCases.createPost.execute({
        companyId: COMPANY_A,
        input: { title: 'a', coverImageUrl: 'javascript:alert(1)' },
      }),
    ).rejects.toThrow()
  })
})

describe('publicação e agendamento', () => {
  it('publica agora e o post aparece no público', async () => {
    const { module } = buildTestModule()
    const { createPost, publishPost, getPublishedPostBySlug } = module.useCases
    const post = await createPost.execute({ companyId: COMPANY_A, input: { title: 'Agora' } })
    const published = await publishPost.execute({ companyId: COMPANY_A, id: post.id })
    expect(published.status).toBe(POST_STATUS.PUBLISHED)
    expect(published.publishedAt).toBe('2026-11-20T12:00:00.000Z')
    expect((await getPublishedPostBySlug.execute({ companyId: COMPANY_A, slug: 'agora' })).title).toBe('Agora')
  })

  it('agendado fica fora do ar até o instante e entra sozinho, sem cron', async () => {
    const { module, clock } = buildTestModule()
    const { createPost, publishPost, getPublishedPostBySlug, listPublishedPosts, getPost } = module.useCases
    const post = await createPost.execute({ companyId: COMPANY_A, input: { title: 'Futuro' } })
    const scheduled = await publishPost.execute({
      companyId: COMPANY_A,
      id: post.id,
      input: { publishedAt: '2026-11-20T15:00:00.000Z' },
    })
    expect(scheduled.status).toBe(POST_STATUS.SCHEDULED)

    await expect(getPublishedPostBySlug.execute({ companyId: COMPANY_A, slug: 'futuro' })).rejects.toMatchObject({
      statusCode: 404,
    })
    expect((await listPublishedPosts.execute({ companyId: COMPANY_A })).data).toHaveLength(0)

    clock.set('2026-11-20T15:00:00.000Z')
    expect((await getPublishedPostBySlug.execute({ companyId: COMPANY_A, slug: 'futuro' })).slug).toBe('futuro')
    expect((await listPublishedPosts.execute({ companyId: COMPANY_A })).data).toHaveLength(1)
    expect((await getPost.execute({ companyId: COMPANY_A, id: post.id })).status).toBe(POST_STATUS.PUBLISHED)
  })

  it('filtro do painel segue o status visível do agendado', async () => {
    const { module, clock } = buildTestModule()
    const { createPost, publishPost, listPosts } = module.useCases
    const post = await createPost.execute({ companyId: COMPANY_A, input: { title: 'Agendado' } })
    await publishPost.execute({ companyId: COMPANY_A, id: post.id, input: { publishedAt: '2026-11-21T00:00:00.000Z' } })

    expect((await listPosts.execute({ companyId: COMPANY_A, status: 'scheduled' })).data).toHaveLength(1)
    clock.set('2026-11-22T00:00:00.000Z')
    expect((await listPosts.execute({ companyId: COMPANY_A, status: 'scheduled' })).data).toHaveLength(0)
    expect((await listPosts.execute({ companyId: COMPANY_A, status: 'published' })).data).toHaveLength(1)
  })

  it('despublicar tira do ar e cancela agendamento; arquivar some do site', async () => {
    const { module } = buildTestModule()
    const { createPost, publishPost, unpublishPost, archivePost, listPublishedPosts } = module.useCases
    const a = await createPost.execute({ companyId: COMPANY_A, input: { title: 'A' } })
    const b = await createPost.execute({ companyId: COMPANY_A, input: { title: 'B' } })
    await publishPost.execute({ companyId: COMPANY_A, id: a.id })
    await publishPost.execute({ companyId: COMPANY_A, id: b.id })

    const draft = await unpublishPost.execute({ companyId: COMPANY_A, id: a.id })
    expect(draft.status).toBe(POST_STATUS.DRAFT)
    expect(draft.publishedAt).toBeNull()
    expect((await archivePost.execute({ companyId: COMPANY_A, id: b.id })).status).toBe(POST_STATUS.ARCHIVED)
    expect((await listPublishedPosts.execute({ companyId: COMPANY_A })).data).toHaveLength(0)
  })

  it('público lista por tag, mais recente primeiro, sem companyId nem corpo', async () => {
    const { module, clock } = buildTestModule()
    const { createPost, publishPost, listPublishedPosts, listTags } = module.useCases
    for (const [title, tags] of [
      ['Um', ['dicas']],
      ['Dois', ['dicas', 'eventos']],
      ['Três', ['eventos']],
    ] as const) {
      const post = await createPost.execute({ companyId: COMPANY_A, input: { title, tags: [...tags], body: 'corpo' } })
      await publishPost.execute({ companyId: COMPANY_A, id: post.id })
      clock.advanceMinutes(1)
    }
    await createPost.execute({ companyId: COMPANY_A, input: { title: 'Rascunho', tags: ['rascunho'] } })

    const page = await listPublishedPosts.execute({ companyId: COMPANY_A, tag: 'Dicas', pageSize: 1 })
    expect(page.data.map((post) => post.title)).toEqual(['Dois'])
    expect(page.pagination).toEqual({ total: 2, page: 1, pageSize: 1, totalPages: 2 })
    expect(page.data[0]).not.toHaveProperty('companyId')
    expect(page.data[0]).not.toHaveProperty('body')

    expect(await listTags.execute({ companyId: COMPANY_A, scope: 'public' })).toEqual([
      { tag: 'dicas', count: 2 },
      { tag: 'eventos', count: 2 },
    ])
    expect((await listTags.execute({ companyId: COMPANY_A, scope: 'admin' })).map((entry) => entry.tag)).toContain(
      'rascunho',
    )
  })
})

describe('isolamento entre empresas', () => {
  it('outra empresa não lê, não edita, não publica, não arquiva e não lista', async () => {
    const { module, store } = buildTestModule()
    const { createPost, publishPost } = module.useCases
    const post = await createPost.execute({ companyId: COMPANY_A, input: { title: 'Privado' } })
    await publishPost.execute({ companyId: COMPANY_A, id: post.id })
    const foreign = { companyId: COMPANY_B, id: post.id }

    await expect(module.useCases.getPost.execute(foreign)).rejects.toMatchObject({ statusCode: 404 })
    await expect(module.useCases.updatePost.execute({ ...foreign, input: { title: 'x' } })).rejects.toMatchObject({
      statusCode: 404,
    })
    await expect(module.useCases.publishPost.execute(foreign)).rejects.toMatchObject({ statusCode: 404 })
    await expect(module.useCases.unpublishPost.execute(foreign)).rejects.toMatchObject({ statusCode: 404 })
    await expect(module.useCases.archivePost.execute(foreign)).rejects.toMatchObject({ statusCode: 404 })
    await expect(
      module.useCases.getPublishedPostBySlug.execute({ companyId: COMPANY_B, slug: 'privado' }),
    ).rejects.toMatchObject({
      statusCode: 404,
    })
    expect((await module.useCases.listPosts.execute({ companyId: COMPANY_B })).data).toHaveLength(0)
    expect((await module.useCases.listPublishedPosts.execute({ companyId: COMPANY_B })).data).toHaveLength(0)
    expect(store.rows[0]?.title).toBe('Privado')
  })
})

describe('ganchos', () => {
  it('avisa cada escrita, e falha no gancho não desfaz a escrita', async () => {
    const events: PostChangedEvent[] = []
    const { module } = buildTestModule({
      hooks: {
        onPostChanged: (event) => {
          events.push(event)
          if (event.type === POST_EVENT.PUBLISHED) throw new Error('cdn fora')
        },
      },
    })
    const post = await module.useCases.createPost.execute({ companyId: COMPANY_A, input: { title: 'Gancho' } })
    const published = await module.useCases.publishPost.execute({ companyId: COMPANY_A, id: post.id })
    expect(published.status).toBe(POST_STATUS.PUBLISHED)
    expect(events.map((event) => event.type)).toEqual([POST_EVENT.CREATED, POST_EVENT.PUBLISHED])
  })
})

describe('capa', () => {
  const storage = {
    uploads: [] as { key: string; mimeType: string }[],
    async upload(params: { buffer: Uint8Array; mimeType: string; key: string }) {
      this.uploads.push({ key: params.key, mimeType: params.mimeType })
      return { url: `https://cdn.example.com/${params.key}`, key: params.key }
    },
  }

  it('sem storage, o use-case não existe', () => {
    expect(buildTestModule().module.useCases.uploadCoverImage).toBeUndefined()
  })

  it('aceita jpeg/png/webp com chave sem nome de arquivo; recusa svg, vazio e grande', async () => {
    const upload = buildTestModule({ imageStorage: storage }).module.useCases.uploadCoverImage
    if (!upload) throw new Error('upload ausente')
    const result = await upload.execute({
      companyId: COMPANY_A,
      bytes: new Uint8Array([1, 2]),
      mimeType: 'image/PNG; charset=binary',
    })
    expect(result.key).toMatch(new RegExp(`^content/posts/${COMPANY_A}/[0-9a-f-]{36}\\.png$`))

    await expect(
      upload.execute({ companyId: COMPANY_A, bytes: new Uint8Array([1]), mimeType: 'image/svg+xml' }),
    ).rejects.toMatchObject({
      details: { reason: 'unsupported_type' },
    })
    await expect(
      upload.execute({ companyId: COMPANY_A, bytes: new Uint8Array(), mimeType: 'image/png' }),
    ).rejects.toMatchObject({
      details: { reason: 'empty' },
    })
    await expect(
      upload.execute({ companyId: COMPANY_A, bytes: new Uint8Array(1024 * 1024 + 1), mimeType: 'image/png' }),
    ).rejects.toMatchObject({ details: { reason: 'too_large' } })
  })
})

describe('configuração', () => {
  it('falha no boot com feed sem endereço absoluto ou modelo sem {slug}', () => {
    expect(() => buildTestModule({ config: { feed: { siteUrl: '/blog', title: 'Blog' } } })).toThrow()
    expect(() =>
      buildTestModule({
        config: { feed: { siteUrl: 'https://example.com', title: 'Blog', postPathTemplate: '/blog' } },
      }),
    ).toThrow()
  })
})
