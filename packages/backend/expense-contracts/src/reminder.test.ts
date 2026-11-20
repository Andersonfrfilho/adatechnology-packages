/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */
import { describe, expect, test } from 'bun:test'

import {
  DEFAULT_REMINDER_SETTINGS,
  buildExpenseMailButtonHtml,
  buildExpenseReminderValues,
  chooseReminderRecipients,
  isBarredFromReminders,
  personalReminderChannels,
  reminderKindOn,
  renderPlainTemplate,
  DEFAULT_EXPENSE_REMINDER_WHATSAPP_TEXT,
} from './index'

describe('quando avisar', () => {
  test.each([
    ['2026-11-13', 'before'],
    ['2026-11-12', null],
    ['2026-11-10', 'due_today'],
    ['2026-11-07', 'overdue'],
    ['2026-11-06', null],
  ] as const)('%s → %s', (dueDate, expected) => {
    expect(reminderKindOn({ dueDate, settings: DEFAULT_REMINDER_SETTINGS, today: '2026-11-10' })).toBe(expected)
  })
})

describe('quem recebe', () => {
  const admin = { channels: ['email', 'whatsapp'] as const, userId: 'admin' }

  test('responsável sem canal ligado cai no administrador', () => {
    const choice = chooseReminderRecipients({
      admins: [admin, admin],
      companyChannels: ['email'],
      responsible: { channels: ['push'], userId: 'resp' },
    })
    expect(choice).toEqual({
      reason: 'responsible_unreachable',
      recipients: [{ channels: ['email'], userId: 'admin' }],
    })
  })

  test('WhatsApp só com opt-in e número verificado', () => {
    expect(
      personalReminderChannels({ hasEmail: true, hasVerifiedWhatsapp: false, pushOptIn: false, whatsappOptIn: true }),
    ).toEqual(['email'])
  })

  test('equipe de campo pura não recebe; com papel de escritório recebe', () => {
    const fieldRoles = ['driver', 'kitchen']
    expect(isBarredFromReminders({ fieldRoles, neutralRoles: ['viewer'], roles: ['driver', 'viewer'] })).toBe(true)
    expect(isBarredFromReminders({ fieldRoles, roles: ['driver', 'finance'] })).toBe(false)
    expect(isBarredFromReminders({ fieldRoles, isFieldStaff: true, roles: [] })).toBe(true)
  })
})

describe('texto do aviso', () => {
  test('valores em pt-BR e o nome da empresa na variável escolhida', () => {
    const values = buildExpenseReminderValues(
      {
        amount: '1234.5',
        categoryName: 'Aluguel',
        companyDisplayName: 'Restaurante Sakura',
        competence: '2026-11',
        dueDate: '2026-11-12',
        expenseName: 'Aluguel do salão',
        payeeName: null,
        recipientName: 'Ana',
        today: '2026-11-10',
      },
      { companyVariable: 'restaurante' },
    )
    expect(values).toMatchObject({
      favorecido: '—',
      restaurante: 'Restaurante Sakura',
      situacao: 'vence em 2 dias',
      valor: 'R$ 1.234,50',
      vencimento: '12/11/2026',
    })
    expect(renderPlainTemplate(DEFAULT_EXPENSE_REMINDER_WHATSAPP_TEXT, values)).toContain(
      '*Aluguel do salão* (Aluguel)',
    )
  })

  test('botão escapa e exige https', () => {
    expect(buildExpenseMailButtonHtml({ label: 'Já paguei', primary: true, url: 'http://x' })).toBe('')
    expect(buildExpenseMailButtonHtml({ label: '<b>', primary: false, url: 'https://x/?a=1&b=2' })).toContain(
      'https://x/?a=1&amp;b=2',
    )
  })
})
