/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'
import { FlowRunnerError, type FlowNodeData } from '@adatechnology/meta-whatsapp-contracts'
import { buildRunner, graph, replyMessage, textMessage } from './flowRunnerHarness'
import { DYNAMIC_CHOICE_MORE_ID, FLOW_RUNTIME_CONTEXT_KEY } from './flowRunner.constant'

const MENU: FlowNodeData = {
  id: 'menu',
  type: 'menu',
  question: 'Olá {{contactFirstName}}! Como posso ajudar?',
  options: [
    ['book', '📅 Reservar'],
    ['faq', '❓ Dúvidas'],
    ['human', '🙋 Atendente'],
  ],
  fallbackMessage: 'Escolha uma das opções.',
  next: {
    byAnswer: { book: 'flow:booking', faq: 'faqAsk', human: 'handoff' },
    byKeyword: { horario: 'hours' },
    default: 'menu',
  },
}

const MAIN = graph('main', 'menu', [
  MENU,
  {
    id: 'faqAsk',
    type: 'question',
    question: 'Qual a sua dúvida?',
    next: { byAnswer: {}, byKeyword: { horario: 'hours' }, default: 'handoff' },
  },
  { id: 'hours', type: 'action', directMessage: 'Abrimos das 8h às 18h.' },
  { id: 'handoff', type: 'action', actionKind: 'handoff' },
])

const BOOKING = graph('booking', 'date', [
  {
    id: 'date',
    type: 'question',
    questionType: 'date',
    contextKey: 'date',
    question: 'Para qual dia?',
    validation: { minDate: 'today' },
    fallbackMessage: 'Use o formato dd/mm, a partir de hoje.',
    next: 'people',
  },
  {
    id: 'people',
    type: 'question',
    questionType: 'int',
    contextKey: 'people',
    question: 'Quantas pessoas?',
    validation: { min: 1, max: 8 },
    next: 'code',
  },
  { id: 'code', type: 'action', actionKind: 'generate_code', next: 'confirm' },
  {
    id: 'confirm',
    type: 'action',
    directMessage: 'Pedido {{code}}: dia {{date}}, {{people}} pessoas. Obrigado, {{contactFirstName}}!',
  },
])

function frontDesk(config: Parameters<typeof buildRunner>[0]['config'] = {}) {
  const harness = buildRunner({ graphs: [MAIN, BOOKING], config })
  harness.interpreter.registerFlowAction('generate_code', async () => ({ context: { code: 'R-042' } }))
  return harness
}

describe('FlowRunner — start and choices', () => {
  it('renders the start menu as buttons with the contact first name', async () => {
    const harness = frontDesk()
    expect(await harness.handle(textMessage('oi'), 'Ana Souza')).toBe('handled')

    const [menu] = harness.takeSent()
    expect(menu).toEqual({
      kind: 'interactive',
      interactive: {
        kind: 'buttons',
        body: 'Olá Ana! Como posso ajudar?',
        buttons: [
          { id: 'book', title: '📅 Reservar' },
          { id: 'faq', title: '❓ Dúvidas' },
          { id: 'human', title: '🙋 Atendente' },
        ],
      },
    })
    expect(harness.row.flowKey).toBe('main')
    expect(harness.row.currentNodeId).toBe('menu')
  })

  it('renders a list when options carry descriptions and sections', async () => {
    const harness = buildRunner({
      graphs: [
        graph('main', 'menu', [
          {
            ...MENU,
            optionDetails: {
              book: { description: 'Escolha dia e horário', section: 'Reservas' },
              faq: { section: 'Ajuda' },
              human: { section: 'Ajuda' },
            },
          },
        ]),
      ],
    })
    await harness.handle(textMessage('oi'))
    const [menu] = harness.takeSent()
    expect(menu?.kind === 'interactive' && menu.interactive).toMatchObject({
      kind: 'list',
      buttonLabel: 'Ver opções',
      sections: [
        { title: 'Reservas', rows: [{ id: 'book', title: '📅 Reservar', description: 'Escolha dia e horário' }] },
        { title: 'Ajuda', rows: [{ id: 'faq' }, { id: 'human' }] },
      ],
    })
  })

  it('falls back to numbered text when titles exceed the channel limits', async () => {
    const harness = buildRunner({
      graphs: [
        graph('main', 'menu', [{ ...MENU, options: [['a', 'Uma opção com um título comprido demais para lista']] }]),
      ],
    })
    await harness.handle(textMessage('oi'))
    expect(harness.takeSent()[0]).toEqual({
      kind: 'text',
      body: 'Olá ! Como posso ajudar?\n\n1. Uma opção com um título comprido demais para lista',
    })
  })

  it('answers FAQ by keyword at the first message without showing the menu', async () => {
    const harness = frontDesk()
    await harness.handle(textMessage('Qual o horário de vocês?'))
    expect(harness.takeSent()).toEqual([{ kind: 'text', body: 'Abrimos das 8h às 18h.' }])
    expect(harness.row.currentNodeId).toBeNull()
  })

  it('routes free text by keyword on a question node, falling back to default', async () => {
    const harness = frontDesk()
    await harness.handle(textMessage('oi'))
    await harness.handle(replyMessage('faq'))
    harness.takeSent()

    await harness.handle(textMessage('e o horario?'))
    expect(harness.takeSent()).toEqual([{ kind: 'text', body: 'Abrimos das 8h às 18h.' }])
  })
})

describe('FlowRunner — validation, actions and cross-flow', () => {
  it('jumps to another flow, validates the date and int and interpolates the summary', async () => {
    const harness = frontDesk()
    await harness.handle(textMessage('oi'), 'Ana Souza')
    harness.takeSent()

    await harness.handle(textMessage('reservar'), 'Ana Souza')
    expect(harness.takeSent()).toEqual([{ kind: 'text', body: 'Para qual dia?' }])
    expect(harness.row.flowKey).toBe('booking')

    await harness.handle(textMessage('01/01/2020'), 'Ana Souza')
    expect(harness.takeSent()).toEqual([
      { kind: 'text', body: 'Use o formato dd/mm, a partir de hoje.' },
      { kind: 'text', body: 'Para qual dia?' },
    ])

    await harness.handle(textMessage('amanhã'), 'Ana Souza')
    expect(harness.takeSent()).toEqual([{ kind: 'text', body: 'Quantas pessoas?' }])
    expect(harness.row.context['date']).toBe('2026-11-26')

    await harness.handle(textMessage('somos 4'), 'Ana Souza')
    expect(harness.takeSent()).toEqual([
      { kind: 'text', body: 'Pedido R-042: dia 26/11/2026, 4 pessoas. Obrigado, Ana!' },
    ])
    expect(harness.row.context).toMatchObject({ date: '2026-11-26', people: 4, code: 'R-042' })
    expect(harness.row.currentNodeId).toBeNull()
  })

  it('hands off after the second invalid answer', async () => {
    const harness = frontDesk()
    await harness.handle(textMessage('oi'))
    await harness.handle(textMessage('tchau'))
    expect(harness.takeSent().slice(1)).toEqual([
      { kind: 'text', body: 'Escolha uma das opções.' },
      expect.objectContaining({ kind: 'interactive' }),
    ])
    expect(harness.row.context[FLOW_RUNTIME_CONTEXT_KEY]).toMatchObject({ invalidAnswers: 1 })

    await harness.handle(textMessage('qualquer coisa'))
    expect(harness.humanRequests).toHaveLength(1)
    expect(harness.takeSent()).toEqual([
      { kind: 'text', body: 'Vou chamar uma pessoa da equipe para continuar por aqui.' },
    ])
    expect(harness.row.currentNodeId).toBeNull()

    expect(await harness.handle(textMessage('alô?'))).toBe('awaiting-human')
    expect(harness.takeSent()).toEqual([])
  })

  it('reports a cross-flow target that does not exist', async () => {
    const harness = buildRunner({ graphs: [graph('main', 'go', [{ id: 'go', type: 'action', next: 'flow:missing' }])] })
    await harness.handle(textMessage('oi'))
    expect(harness.errors[0]).toBeInstanceOf(FlowRunnerError)
    expect(harness.row.flowKey).toBeNull()
  })
})

describe('FlowRunner — global cancel and back', () => {
  const KEYWORDS = [
    { keywords: ['sair', 'cancelar'], target: 'cancel' as const },
    { keywords: ['voltar'], target: 'back' as const },
    { keywords: ['menu'], target: 'restart' as const },
  ]

  async function midBooking() {
    const harness = frontDesk({ globalKeywords: KEYWORDS, cancelMessage: 'Tudo bem, {{contactFirstName}}! Cancelei.' })
    await harness.handle(textMessage('oi'), 'Ana Souza')
    await harness.handle(replyMessage('book'))
    await harness.handle(textMessage('25/12'))
    harness.takeSent()
    return harness
  }

  it('cancels at the first, middle and last step, clearing what was collected', async () => {
    const harness = await midBooking()
    expect(harness.row.currentNodeId).toBe('people')
    expect(harness.row.context['date']).toBeDefined()

    await harness.handle(textMessage('Sair'), 'Ana Souza')
    expect(harness.takeSent()).toEqual([{ kind: 'text', body: 'Tudo bem, Ana! Cancelei.' }])
    expect(harness.row.flowKey).toBeNull()
    expect(harness.row.currentNodeId).toBeNull()
    expect(harness.row.context['date']).toBeUndefined()

    await harness.handle(textMessage('oi'))
    expect(harness.row.currentNodeId).toBe('menu')
    await harness.handle(textMessage('cancelar'))
    expect(harness.takeSent().at(-1)).toMatchObject({ kind: 'text' })
    expect(harness.row.currentNodeId).toBeNull()
  })

  it('keeps only the context keys listed in preserveOnCancel', async () => {
    const harness = frontDesk({ globalKeywords: KEYWORDS, preserveOnCancel: ['date'] })
    await harness.handle(textMessage('oi'))
    await harness.handle(replyMessage('book'))
    await harness.handle(textMessage('25/12'))
    await harness.handle(textMessage('sair'))
    expect(harness.row.context['date']).toBeDefined()
    expect(harness.row.context['people']).toBeUndefined()
  })

  it('uses the package default farewell when none is configured', async () => {
    const harness = frontDesk({ globalKeywords: KEYWORDS })
    await harness.handle(textMessage('oi'))
    harness.takeSent()
    await harness.handle(textMessage('sair'))
    expect(harness.takeSent()).toEqual([{ kind: 'text', body: expect.stringContaining('Cancelei') }])
  })

  it('does not cancel when the command is only part of a sentence', async () => {
    const harness = await midBooking()
    await harness.handle(textMessage('quero sair para jantar dia 10'))
    expect(harness.row.currentNodeId).toBe('people')
    expect(harness.row.context['date']).toBeDefined()
  })

  it('goes back to the previous question with the context it had, then forward again', async () => {
    const back = await midBooking()
    await back.handle(textMessage('voltar'))
    expect(back.takeSent()).toEqual([{ kind: 'text', body: 'Para qual dia?' }])
    expect(back.row.currentNodeId).toBe('date')
    expect(back.row.context['date']).toBeUndefined()

    await back.handle(textMessage('26/12'))
    expect(back.row.currentNodeId).toBe('people')
    await back.handle(textMessage('voltar'))
    await back.handle(textMessage('voltar'))
    expect(back.row.flowKey).toBe('main')
    expect(back.row.currentNodeId).toBe('menu')
  })

  it('at the first question of the conversation, back shows the start menu', async () => {
    const harness = frontDesk({ globalKeywords: KEYWORDS })
    await harness.handle(textMessage('oi'))
    harness.takeSent()
    await harness.handle(textMessage('voltar'))
    expect(harness.takeSent()[0]).toMatchObject({ kind: 'interactive' })
    expect(harness.row.currentNodeId).toBe('menu')
  })

  it('restart clears the trail, so back after the menu does not return to the abandoned flow', async () => {
    const harness = await midBooking()
    await harness.handle(textMessage('menu'))
    harness.takeSent()
    await harness.handle(textMessage('voltar'))
    expect(harness.row.flowKey).toBe('main')
    expect(harness.row.currentNodeId).toBe('menu')
  })
})

describe('FlowRunner — global keywords and handoff', () => {
  const HOURS = {
    timeZone: 'America/Sao_Paulo',
    windows: [{ weekday: 1 as const, start: '08:00', end: '18:00' }],
  }

  it('restarts the start flow from any node', async () => {
    const harness = frontDesk({ globalKeywords: [{ keywords: ['menu'], target: 'restart' }] })
    await harness.handle(textMessage('oi'))
    await harness.handle(replyMessage('book'))
    harness.takeSent()

    await harness.handle(textMessage('MENÚ'))
    expect(harness.takeSent()[0]).toMatchObject({ kind: 'interactive' })
    expect(harness.row.flowKey).toBe('main')
  })

  it('hands off when a word-mode keyword appears inside the message', async () => {
    const harness = frontDesk({ globalKeywords: [{ keywords: ['atendente'], target: 'handoff', match: 'word' }] })
    await harness.handle(textMessage('Quero falar com um atendente agora'))
    expect(harness.row.humanRequestedAt).not.toBeNull()
  })

  it('hands off by keyword with the out-of-hours message', async () => {
    const harness = frontDesk({
      globalKeywords: [{ keywords: ['atendente'], target: 'handoff' }],
      handoff: {
        message: 'Já chamei alguém.',
        outOfHoursMessage: 'Fechados agora, {{contactFirstName}}.',
        businessHours: HOURS,
      },
    })
    await harness.handle(textMessage('Atendente'), 'Ana Souza')
    expect(harness.takeSent()).toEqual([{ kind: 'text', body: 'Fechados agora, Ana.' }])
    expect(harness.row.context['handoffWithinBusinessHours']).toBe(false)
  })

  it('runs the built-in handoff node within business hours', async () => {
    const harness = frontDesk({
      handoff: {
        message: 'Já chamei alguém.',
        businessHours: { ...HOURS, windows: [{ weekday: 3, start: '08:00', end: '18:00' }] },
      },
    })
    await harness.handle(textMessage('oi'))
    harness.takeSent()
    await harness.handle(replyMessage('human'))
    expect(harness.takeSent()).toEqual([{ kind: 'text', body: 'Já chamei alguém.' }])
    expect(harness.humanRequests).toHaveLength(1)
  })
})

describe('FlowRunner — dynamic choice', () => {
  const slots = Array.from({ length: 12 }, (_, index) => ({
    id: `slot-${index}`,
    title: `${8 + index}h`,
    description: 'livre',
  }))

  it('pages options, stores the chosen id and accepts "see more"', async () => {
    const harness = buildRunner({
      graphs: [
        graph('main', 'slot', [
          {
            id: 'slot',
            type: 'dynamic_choice',
            question: 'Escolha o horário',
            choiceProvider: 'slots',
            contextKey: 'slot',
            next: 'done',
          },
          { id: 'done', type: 'action', directMessage: 'Reservado: {{slot}}' },
        ]),
      ],
      config: {
        dynamicChoiceProviders: {
          slots: async ({ page, pageSize }) => ({
            options: slots.slice(page * pageSize, (page + 1) * pageSize),
            hasMore: (page + 1) * pageSize < slots.length,
          }),
        },
      },
    })

    await harness.handle(textMessage('oi'))
    const [firstPage] = harness.takeSent()
    const rows =
      firstPage?.kind === 'interactive' && firstPage.interactive.kind === 'list'
        ? firstPage.interactive.sections[0]!.rows
        : []
    expect(rows).toHaveLength(10)
    expect(rows[9]).toEqual({ id: DYNAMIC_CHOICE_MORE_ID, title: 'Ver mais' })

    await harness.handle(replyMessage(DYNAMIC_CHOICE_MORE_ID, 'list'))
    const [secondPage] = harness.takeSent()
    expect(
      secondPage?.kind === 'interactive' &&
        secondPage.interactive.kind === 'list' &&
        secondPage.interactive.sections[0]!.rows.map((row) => row.id),
    ).toEqual(['slot-9', 'slot-10', 'slot-11'])

    await harness.handle(textMessage('2'))
    expect(harness.takeSent()).toEqual([{ kind: 'text', body: 'Reservado: slot-10' }])
    expect(harness.row.context['slot']).toBe('slot-10')
  })

  it('reports a provider that is not registered', async () => {
    const harness = buildRunner({
      graphs: [graph('main', 'slot', [{ id: 'slot', type: 'dynamic_choice', choiceProvider: 'nope' }])],
    })
    await harness.handle(textMessage('oi'))
    expect(harness.errors[0]).toMatchObject({ reason: 'provider-missing' })
  })
})
