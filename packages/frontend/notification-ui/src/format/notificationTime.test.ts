/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * A linha da inbox mostrava título e corpo e mais nada. Dois avisos do mesmo assunto — um de agora,
 * outro da semana passada — ficavam indistinguíveis, e a ordem da lista virava afirmação sem prova:
 * quem lê não tem como saber se o topo é o mais recente. O horário é o dado que faz a caixa de
 * entrada ser uma caixa de entrada.
 *
 * Este é o único pedaço do pacote que dá para testar de verdade sem DOM (o resto é inspeção de
 * fonte): entra o instante e o "agora", sai texto. Por isso `now` é parâmetro, e não `new Date()`
 * escondido lá dentro — relógio implícito é teste que passa de manhã e falha à noite.
 */

import { describe, expect, it } from 'bun:test'

import { formatNotificationTime, formatNotificationTimestamp } from './notificationTime'

const NOW = new Date('2026-08-19T15:00:00.000Z')

function minutesAgo(minutes: number): string {
  return new Date(NOW.getTime() - minutes * 60_000).toISOString()
}

describe('horário relativo da inbox', () => {
  it('o que acabou de chegar não vira número', () => {
    // "há 12 segundos" é precisão que ninguém pediu; "agora" é a informação inteira.
    expect(formatNotificationTime(minutesAgo(0.2), 'pt-BR', NOW)).not.toMatch(/\d/)
  })

  it('minutos e horas aparecem com o número', () => {
    expect(formatNotificationTime(minutesAgo(5), 'pt-BR', NOW)).toContain('5')
    expect(formatNotificationTime(minutesAgo(3 * 60), 'pt-BR', NOW)).toContain('3')
  })

  it('dentro da semana o texto é relativo, não data', () => {
    const yesterday = formatNotificationTime(minutesAgo(26 * 60), 'pt-BR', NOW)

    expect(yesterday).not.toContain('/')
    expect(yesterday.length).toBeGreaterThan(0)
  })

  it('passada a semana, relativo deixa de ajudar e vira data', () => {
    // "há 43 dias" obriga o leitor a fazer conta; a data ele lê.
    expect(formatNotificationTime(minutesAgo(43 * 24 * 60), 'pt-BR', NOW)).toContain('2026')
  })

  it('respeita o locale do provider', () => {
    expect(formatNotificationTime(minutesAgo(5), 'pt-BR', NOW)).not.toBe(
      formatNotificationTime(minutesAgo(5), 'en', NOW),
    )
  })

  it('relógio adiantado não vira "daqui a 2 minutos"', () => {
    // Desvio de relógio entre o servidor e o navegador é normal; anunciar futuro é que não é.
    const future = new Date(NOW.getTime() + 2 * 60_000).toISOString()

    expect(formatNotificationTime(future, 'pt-BR', NOW)).toBe(formatNotificationTime(minutesAgo(0), 'pt-BR', NOW))
  })

  it('data ilegível não quebra a linha — some', () => {
    expect(formatNotificationTime('nao-e-data', 'pt-BR', NOW)).toBe('')
    expect(formatNotificationTimestamp('nao-e-data', 'pt-BR')).toBe('')
  })

  it('o timestamp cheio é o que o `title` mostra ao parar o mouse', () => {
    const full = formatNotificationTimestamp(minutesAgo(5), 'pt-BR')

    expect(full).toContain('2026')
    // Data sem hora não serve de complemento ao relativo: é justamente a hora que o relativo esconde.
    expect(full).toMatch(/\d{1,2}[:h]\d{2}/)
  })
})
