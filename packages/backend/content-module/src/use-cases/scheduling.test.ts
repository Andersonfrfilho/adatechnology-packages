/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'
import { randomUUID } from 'node:crypto'
import { CONTENT_ERROR_CODES, POST_EVENT, POST_STATUS, type PostChangedEvent } from '@adatechnology/content-contracts'

import { nextOccurrence, nextOccurrenceAfter } from '../shared/recurrence'
import { buildTestModule } from '../testing/buildTestModule'

const COMPANY_A = randomUUID()
const COMPANY_B = randomUUID()

function withEvents() {
  const events: PostChangedEvent[] = []
  const built = buildTestModule({ hooks: { onPostChanged: (event) => void events.push(event) } })
  return { ...built, events }
}

async function publishedPost(built: ReturnType<typeof buildTestModule>, title = 'Promoção') {
  const { createPost, publishPost } = built.module.useCases
  const post = await createPost.execute({ companyId: COMPANY_A, input: { title, body: 'corpo', tags: ['a'] } })
  return publishPost.execute({ companyId: COMPANY_A, id: post.id })
}

describe('abas e contagens', () => {
  it('conta por status mostrado e separa modelos; lista nunca mistura modelo', async () => {
    const built = buildTestModule()
    const { createPost, publishPost, saveAsTemplate, countPosts, listPosts, archivePost } = built.module.useCases
    const published = await publishedPost(built, 'No ar')
    const scheduled = await createPost.execute({ companyId: COMPANY_A, input: { title: 'Futuro' } })
    await publishPost.execute({
      companyId: COMPANY_A,
      id: scheduled.id,
      input: { publishedAt: '2026-12-01T00:00:00.000Z' },
    })
    await createPost.execute({ companyId: COMPANY_A, input: { title: 'Rascunho' } })
    const gone = await createPost.execute({ companyId: COMPANY_A, input: { title: 'Velho' } })
    await archivePost.execute({ companyId: COMPANY_A, id: gone.id })
    await saveAsTemplate.execute({ companyId: COMPANY_A, id: published.id })
    await publishedPost({ ...built, module: built.module }, 'Outro')

    expect(await countPosts.execute({ companyId: COMPANY_A })).toEqual({
      published: 2,
      scheduled: 1,
      draft: 1,
      archived: 1,
      templates: 1,
    })
    expect(await countPosts.execute({ companyId: COMPANY_B })).toEqual({
      published: 0,
      scheduled: 0,
      draft: 0,
      archived: 0,
      templates: 0,
    })
    const posts = await listPosts.execute({ companyId: COMPANY_A, pageSize: 50 })
    expect(posts.data.some((post) => post.isTemplate)).toBe(false)
    const templates = await listPosts.execute({ companyId: COMPANY_A, isTemplate: true })
    expect(templates.data.map((post) => post.isTemplate)).toEqual([true])
  })
})

describe('modelos', () => {
  it('salvar como modelo copia o conteúdo, não toca o original e não vai ao ar', async () => {
    const built = buildTestModule()
    const original = await publishedPost(built)
    const template = await built.module.useCases.saveAsTemplate.execute({ companyId: COMPANY_A, id: original.id })
    expect(template.isTemplate).toBe(true)
    expect(template.status).toBe(POST_STATUS.DRAFT)
    expect(template.body).toBe('corpo')
    expect(template.slug).toBe('modelo-promocao')
    const reread = await built.module.useCases.getPost.execute({ companyId: COMPANY_A, id: original.id })
    expect(reread.status).toBe(POST_STATUS.PUBLISHED)
    expect(reread.isTemplate).toBe(false)
  })

  it('modelo não pode ser publicado', async () => {
    const built = buildTestModule()
    const template = await built.module.useCases.saveAsTemplate.execute({
      companyId: COMPANY_A,
      id: (await publishedPost(built)).id,
    })
    await expect(
      built.module.useCases.publishPost.execute({ companyId: COMPANY_A, id: template.id }),
    ).rejects.toMatchObject({ code: CONTENT_ERROR_CODES.TEMPLATE_NOT_PUBLISHABLE })
  })

  it('novo a partir de modelo cria rascunho com slug livre; post comum não serve de modelo', async () => {
    const built = buildTestModule()
    const original = await publishedPost(built)
    const { saveAsTemplate, createFromTemplate } = built.module.useCases
    const template = await saveAsTemplate.execute({ companyId: COMPANY_A, id: original.id })
    const draft = await createFromTemplate.execute({
      companyId: COMPANY_A,
      id: template.id,
      input: { title: 'Janeiro' },
    })
    expect(draft).toMatchObject({ isTemplate: false, status: POST_STATUS.DRAFT, title: 'Janeiro', slug: 'janeiro' })
    expect(draft.body).toBe('corpo')
    await expect(createFromTemplate.execute({ companyId: COMPANY_A, id: original.id })).rejects.toMatchObject({
      code: CONTENT_ERROR_CODES.NOT_A_TEMPLATE,
    })
  })

  it('canonical não é copiado e outra empresa recebe 404', async () => {
    const built = buildTestModule()
    const post = await built.module.useCases.createPost.execute({
      companyId: COMPANY_A,
      input: { title: 'X', canonicalUrl: 'https://example.com/x' },
    })
    const template = await built.module.useCases.saveAsTemplate.execute({ companyId: COMPANY_A, id: post.id })
    expect(template.canonicalUrl).toBeNull()
    await expect(
      built.module.useCases.saveAsTemplate.execute({ companyId: COMPANY_B, id: post.id }),
    ).rejects.toMatchObject({ statusCode: 404 })
  })
})

describe('republicar', () => {
  it('muda a data e mantém slug e status no ar, avisando o host', async () => {
    const built = withEvents()
    const post = await publishedPost(built)
    built.clock.advanceMinutes(60 * 24 * 30)
    const again = await built.module.useCases.republishPost.execute({ companyId: COMPANY_A, id: post.id })
    expect(again.slug).toBe(post.slug)
    expect(again.status).toBe(POST_STATUS.PUBLISHED)
    expect(again.publishedAt).toBe(built.clock.now().toISOString())
    expect(built.events.at(-1)?.type).toBe(POST_EVENT.REPUBLISHED)
    expect(built.store.rows).toHaveLength(1)
  })

  it('aceita data passada; recusa futura, rascunho e agendado', async () => {
    const built = buildTestModule()
    const { republishPost, createPost, publishPost } = built.module.useCases
    const post = await publishedPost(built)
    const past = await republishPost.execute({
      companyId: COMPANY_A,
      id: post.id,
      input: { publishedAt: '2026-01-05T10:00:00.000Z' },
    })
    expect(past.publishedAt).toBe('2026-01-05T10:00:00.000Z')
    await expect(
      republishPost.execute({ companyId: COMPANY_A, id: post.id, input: { publishedAt: '2027-01-01T00:00:00.000Z' } }),
    ).rejects.toMatchObject({ code: CONTENT_ERROR_CODES.REPUBLISH_DATE_IN_FUTURE })
    const draft = await createPost.execute({ companyId: COMPANY_A, input: { title: 'R' } })
    await expect(republishPost.execute({ companyId: COMPANY_A, id: draft.id })).rejects.toMatchObject({
      code: CONTENT_ERROR_CODES.NOT_PUBLISHED,
    })
    await publishPost.execute({
      companyId: COMPANY_A,
      id: draft.id,
      input: { publishedAt: '2026-12-01T00:00:00.000Z' },
    })
    await expect(republishPost.execute({ companyId: COMPANY_A, id: draft.id })).rejects.toMatchObject({
      code: CONTENT_ERROR_CODES.NOT_PUBLISHED,
    })
  })
})

describe('publishDue', () => {
  async function scheduleAt(built: ReturnType<typeof withEvents>, title: string, iso: string) {
    const post = await built.module.useCases.createPost.execute({ companyId: COMPANY_A, input: { title } })
    return built.module.useCases.publishPost.execute({ companyId: COMPANY_A, id: post.id, input: { publishedAt: iso } })
  }

  it('só publica o vencido, uma vez, notificando o host; segunda chamada não faz nada', async () => {
    const built = withEvents()
    const due = await scheduleAt(built, 'Vence', '2026-11-20T12:30:00.000Z')
    await scheduleAt(built, 'Depois', '2026-11-21T12:30:00.000Z')
    const { publishDue } = built.module.useCases

    expect(await publishDue.execute()).toEqual({ published: 0, materialized: 0 })
    built.clock.advanceMinutes(31)
    expect(await publishDue.execute()).toEqual({ published: 1, materialized: 0 })
    expect(await publishDue.execute()).toEqual({ published: 0, materialized: 0 })

    const stored = built.store.rows.find((row) => row.id === due.id)
    expect(stored?.status).toBe(POST_STATUS.PUBLISHED)
    expect(
      built.events.filter((event) => event.type === POST_EVENT.PUBLISHED && event.post.id === due.id),
    ).toHaveLength(2)
    expect(built.store.rows.find((row) => row.title === 'Depois')?.status).toBe(POST_STATUS.SCHEDULED)
  })

  it('execuções concorrentes não publicam nem notificam o mesmo post duas vezes', async () => {
    const built = withEvents()
    await scheduleAt(built, 'Vence', '2026-11-20T12:30:00.000Z')
    built.clock.advanceMinutes(31)
    const before = built.events.length
    const results = await Promise.all([1, 2, 3, 4].map(() => built.module.useCases.publishDue.execute()))
    expect(results.reduce((total, result) => total + result.published, 0)).toBe(1)
    expect(built.events.length - before).toBe(1)
  })

  it('o parâmetro now reprocessa sem mexer no relógio do módulo', async () => {
    const built = withEvents()
    await scheduleAt(built, 'Vence', '2026-11-20T12:30:00.000Z')
    const result = await built.module.useCases.publishDue.execute({ now: new Date('2026-11-20T13:00:00.000Z') })
    expect(result.published).toBe(1)
  })
})

describe('recorrência', () => {
  async function recurringTemplate(
    built: ReturnType<typeof withEvents>,
    frequency: 'weekly' | 'monthly',
    startsAt: string,
  ) {
    const original = await publishedPost(built, 'Resumo da semana')
    const template = await built.module.useCases.saveAsTemplate.execute({ companyId: COMPANY_A, id: original.id })
    const rule = await built.module.useCases.createRecurrence.execute({
      companyId: COMPANY_A,
      input: { templateId: template.id, frequency, startsAt },
    })
    return { template, rule }
  }

  it('publica um post novo do modelo quando vence e agenda a próxima semana', async () => {
    const built = withEvents()
    const { rule } = await recurringTemplate(built, 'weekly', '2026-11-20T13:00:00.000Z')
    expect(await built.module.useCases.publishDue.execute()).toEqual({ published: 0, materialized: 0 })

    built.clock.advanceMinutes(61)
    expect(await built.module.useCases.publishDue.execute()).toEqual({ published: 0, materialized: 1 })
    const created = built.store.rows.find((row) => row.slug === 'resumo-da-semana-2026-11-20')
    expect(created).toMatchObject({ isTemplate: false, status: POST_STATUS.PUBLISHED, body: 'corpo' })
    expect(await built.module.useCases.publishDue.execute()).toEqual({ published: 0, materialized: 0 })

    const [stored] = await built.module.useCases.listRecurrences.execute({ companyId: COMPANY_A })
    expect(stored?.nextRunAt).toBe('2026-11-27T13:00:00.000Z')
    expect(stored?.lastPostId).toBe(created?.id ?? null)
    expect(stored?.templateTitle).toBe('Resumo da semana')
    expect(rule.isActive).toBe(true)
  })

  it('servidor parado por semanas publica um post só, não uma rajada', async () => {
    const built = withEvents()
    await recurringTemplate(built, 'weekly', '2026-11-20T13:00:00.000Z')
    built.clock.advanceMinutes(60 * 24 * 22)
    expect((await built.module.useCases.publishDue.execute()).materialized).toBe(1)
    expect(built.store.rows.filter((row) => !row.isTemplate)).toHaveLength(2)
  })

  it('pausada não publica; apagar a regra mantém os posts', async () => {
    const built = withEvents()
    const { rule } = await recurringTemplate(built, 'weekly', '2026-11-20T11:00:00.000Z')
    const { updateRecurrence, removeRecurrence, publishDue } = built.module.useCases
    await updateRecurrence.execute({ companyId: COMPANY_A, id: rule.id, input: { isActive: false } })
    expect((await publishDue.execute()).materialized).toBe(0)
    await updateRecurrence.execute({ companyId: COMPANY_A, id: rule.id, input: { isActive: true } })
    expect((await publishDue.execute()).materialized).toBe(1)
    await removeRecurrence.execute({ companyId: COMPANY_A, id: rule.id })
    expect(built.store.rows.filter((row) => !row.isTemplate)).toHaveLength(2)
  })

  it('só modelo vira regra e regra de outra empresa é 404', async () => {
    const built = withEvents()
    const post = await publishedPost(built)
    await expect(
      built.module.useCases.createRecurrence.execute({
        companyId: COMPANY_A,
        input: { templateId: post.id, frequency: 'weekly', startsAt: '2026-12-01T00:00:00.000Z' },
      }),
    ).rejects.toMatchObject({ code: CONTENT_ERROR_CODES.NOT_A_TEMPLATE })
    const { rule } = await recurringTemplate(built, 'monthly', '2026-12-01T00:00:00.000Z')
    await expect(
      built.module.useCases.updateRecurrence.execute({ companyId: COMPANY_B, id: rule.id, input: { isActive: false } }),
    ).rejects.toMatchObject({ code: CONTENT_ERROR_CODES.RECURRENCE_NOT_FOUND })
    await expect(
      built.module.useCases.removeRecurrence.execute({ companyId: COMPANY_B, id: rule.id }),
    ).rejects.toMatchObject({ statusCode: 404 })
  })

  it('modelo apagado desativa a regra em vez de falhar todo ciclo', async () => {
    const built = withEvents()
    const { template, rule } = await recurringTemplate(built, 'weekly', '2026-11-20T11:00:00.000Z')
    await built.module.useCases.archivePost.execute({ companyId: COMPANY_A, id: template.id })
    expect((await built.module.useCases.publishDue.execute()).materialized).toBe(1)
    const [stored] = await built.module.useCases.listRecurrences.execute({ companyId: COMPANY_A })
    expect(stored?.isActive).toBe(false)
    expect(rule.id).toBe(stored?.id ?? '')
    expect(built.store.rows.filter((row) => !row.isTemplate)).toHaveLength(1)
  })
})

describe('datas da recorrência (UTC)', () => {
  it('semanal soma 7 dias', () => {
    expect(
      nextOccurrence({ frequency: 'weekly', from: new Date('2026-11-20T13:00:00Z'), anchorDay: 20 }).toISOString(),
    ).toBe('2026-11-27T13:00:00.000Z')
  })

  it('mensal no dia 31 cai no fim do mês curto e volta ao 31', () => {
    const jan = new Date('2026-01-31T09:00:00Z')
    const feb = nextOccurrence({ frequency: 'monthly', from: jan, anchorDay: 31 })
    expect(feb.toISOString()).toBe('2026-02-28T09:00:00.000Z')
    const mar = nextOccurrence({ frequency: 'monthly', from: feb, anchorDay: 31 })
    expect(mar.toISOString()).toBe('2026-03-31T09:00:00.000Z')
  })

  it('virada de ano e salto das ocorrências perdidas', () => {
    expect(
      nextOccurrence({ frequency: 'monthly', from: new Date('2026-12-15T00:00:00Z'), anchorDay: 15 }).toISOString(),
    ).toBe('2027-01-15T00:00:00.000Z')
    expect(
      nextOccurrenceAfter({
        frequency: 'weekly',
        from: new Date('2026-11-01T00:00:00Z'),
        anchorDay: 1,
        now: new Date('2026-11-20T00:00:00Z'),
      }).toISOString(),
    ).toBe('2026-11-22T00:00:00.000Z')
  })
})

describe('endereço público: id curto, histórico de slug e rótulos', () => {
  it('post nasce com id curto único e slug curto sem palavras de ligação', async () => {
    const { module } = buildTestModule()
    const first = await module.useCases.createPost.execute({
      companyId: COMPANY_A,
      input: { title: 'Novidades de fim de ano: cardápio para as festas' },
    })
    const second = await module.useCases.createPost.execute({ companyId: COMPANY_A, input: { title: 'Outro' } })
    expect(first.slug).toBe('novidades-fim-ano-cardapio-festas')
    expect(first.shortId).toMatch(/^[0-9a-z]{6}$/)
    expect(second.shortId).not.toBe(first.shortId)
  })

  it('acha pelo id curto mesmo com slug errado, e por slug atual e antigo', async () => {
    const built = buildTestModule()
    const { createPost, publishPost, updatePost, getPublishedPostBySlug } = built.module.useCases
    const created = await createPost.execute({ companyId: COMPANY_A, input: { title: 'Titulo antigo' } })
    await publishPost.execute({ companyId: COMPANY_A, id: created.id })
    await updatePost.execute({ companyId: COMPANY_A, id: created.id, input: { slug: 'titulo-novo' } })

    const canonical = `${created.shortId}-titulo-novo`
    for (const ref of [
      canonical,
      `${created.shortId}-titulo-antigo`,
      `${created.shortId}-qualquer`,
      'titulo-novo',
      'titulo-antigo',
    ]) {
      const found = await getPublishedPostBySlug.execute({ companyId: COMPANY_A, slug: ref })
      expect(found.shortId).toBe(created.shortId)
      expect(found.slug).toBe('titulo-novo')
    }
    await expect(getPublishedPostBySlug.execute({ companyId: COMPANY_B, slug: canonical })).rejects.toMatchObject({
      statusCode: 404,
    })
  })

  it('rascunho nunca resolve, nem pelo id curto nem por slug antigo', async () => {
    const built = buildTestModule()
    const { createPost, updatePost, getPublishedPostBySlug } = built.module.useCases
    const draft = await createPost.execute({ companyId: COMPANY_A, input: { title: 'Rascunho' } })
    await updatePost.execute({ companyId: COMPANY_A, id: draft.id, input: { slug: 'outro' } })
    for (const ref of [`${draft.shortId}-outro`, 'rascunho', 'outro']) {
      await expect(getPublishedPostBySlug.execute({ companyId: COMPANY_A, slug: ref })).rejects.toMatchObject({
        statusCode: 404,
      })
    }
  })

  it('rótulo da tag vem do que o autor digitou e sobrevive a editar só o texto', async () => {
    const { module } = buildTestModule()
    const { createPost, updatePost } = module.useCases
    const post = await createPost.execute({ companyId: COMPANY_A, input: { title: 'T', tags: ['Cardápio', 'festas'] } })
    expect(post.tags).toEqual(['cardápio', 'festas'])
    expect(post.tagLabels).toEqual({ cardápio: 'Cardápio' })
    const edited = await updatePost.execute({ companyId: COMPANY_A, id: post.id, input: { body: 'novo' } })
    expect(edited.tagLabels).toEqual({ cardápio: 'Cardápio' })
    const relabeled = await updatePost.execute({
      companyId: COMPANY_A,
      id: post.id,
      input: { tagLabels: { festas: 'Festas & Eventos' } },
    })
    expect(relabeled.tagLabels).toEqual({ cardápio: 'Cardápio', festas: 'Festas & Eventos' })
  })

  it('o canonical público mostra o endereço com id curto no feed', async () => {
    const built = buildTestModule({
      config: { feed: { siteUrl: 'https://example.com', title: 'N', postPathTemplate: '/novidades/{shortId}-{slug}' } },
    })
    const post = await built.module.useCases.createPost.execute({ companyId: COMPANY_A, input: { title: 'Olá' } })
    await built.module.useCases.publishPost.execute({ companyId: COMPANY_A, id: post.id })
    const entries = await built.module.useCases.listSitemapEntries?.execute({ companyId: COMPANY_A })
    expect(entries?.[0]?.loc).toBe(`https://example.com/novidades/${post.shortId}-ola`)
  })
})

describe('lista do painel: ordenação e várias tags', () => {
  async function seed() {
    const built = buildTestModule()
    const { createPost, publishPost } = built.module.useCases
    const make = async (title: string, tags: string[], publishedAt?: string) => {
      const post = await createPost.execute({ companyId: COMPANY_A, input: { title, tags } })
      if (publishedAt) await publishPost.execute({ companyId: COMPANY_A, id: post.id, input: { publishedAt } })
      return post
    }
    await make('Banana', ['fruta'], '2026-01-02T00:00:00.000Z')
    await make('Abacate', ['fruta', 'verde'], '2026-01-03T00:00:00.000Z')
    await make('Cenoura', ['legume'])
    return built
  }

  it('ordena por título e por data de publicação; rascunho sem data fica sempre no fim', async () => {
    const { module } = await seed()
    const titles = async (sort: 'title' | 'publishedAt', order: 'asc' | 'desc') =>
      (await module.useCases.listPosts.execute({ companyId: COMPANY_A, sort, order })).data.map((post) => post.title)
    expect(await titles('title', 'asc')).toEqual(['Abacate', 'Banana', 'Cenoura'])
    expect(await titles('title', 'desc')).toEqual(['Cenoura', 'Banana', 'Abacate'])
    expect(await titles('publishedAt', 'asc')).toEqual(['Banana', 'Abacate', 'Cenoura'])
    expect(await titles('publishedAt', 'desc')).toEqual(['Abacate', 'Banana', 'Cenoura'])
  })

  it('várias tags separadas por vírgula casam com qualquer uma', async () => {
    const { module } = await seed()
    const found = await module.useCases.listPosts.execute({ companyId: COMPANY_A, tag: 'verde,legume' })
    expect(found.data.map((post) => post.title).sort()).toEqual(['Abacate', 'Cenoura'])
    expect((await module.useCases.listPosts.execute({ companyId: COMPANY_A, tag: 'inexistente' })).data).toEqual([])
  })
})
