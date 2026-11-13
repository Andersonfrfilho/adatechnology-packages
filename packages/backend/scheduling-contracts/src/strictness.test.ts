/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * O README deste pacote afirma quatro invariantes. Afirmação sem teste é comentário: alguém
 * adiciona um campo, o texto continua lá, e o contrato passou a mentir. Aqui elas viram falha
 * de build.
 *
 * 1. `companyId` nunca entra por corpo de requisição
 * 2. Fuso horário é IANA validado, nunca string solta
 * 3. Dinheiro é centavo inteiro
 * 4. O pacote não depende de nada do Google Calendar em runtime
 */

import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  createResourceSchema,
  createServiceSchema,
  ianaTimezoneSchema,
  listBookingsQuerySchema,
  requestBookingSchema,
} from './schemas'

const BODY_SCHEMAS = {
  createResource: createResourceSchema,
  createService: createServiceSchema,
  requestBooking: requestBookingSchema,
} as const

describe('companyId não atravessa a fronteira', () => {
  for (const [name, schema] of Object.entries(BODY_SCHEMAS)) {
    it(`${name} rejeita ou descarta companyId enviado pelo cliente`, () => {
      const base =
        name === 'createResource'
          ? { name: 'Sala 1', kind: 'room', timezone: 'America/Sao_Paulo' }
          : name === 'createService'
            ? { name: 'Corte', durationMinutes: 30 }
            : {
                title: 'Reunião',
                during: { start: new Date(Date.now() + 60_000), end: new Date(Date.now() + 120_000) },
                resourceIds: ['00000000-0000-0000-0000-000000000000'],
              }

      const result = schema.safeParse({ ...base, companyId: 'empresa-de-outro' })

      // Zod remove chave desconhecida em vez de rejeitar. O efeito é o que importa: o valor não
      // chega ao use-case, então não há como escolher a empresa alheia pelo corpo.
      if (result.success) {
        expect('companyId' in result.data).toBe(false)
      }
    })
  }

  it('nenhum schema de corpo declara companyId — nem opcional', () => {
    for (const [name, schema] of Object.entries(BODY_SCHEMAS)) {
      const shape = 'shape' in schema ? (schema as { shape: Record<string, unknown> }).shape : {}
      expect(Object.keys(shape), name).not.toContain('companyId')
    }
  })
})

describe('fuso horário é IANA validado', () => {
  it('aceita um fuso IANA real', () => {
    expect(ianaTimezoneSchema.safeParse('America/Sao_Paulo').success).toBe(true)
  })

  it('rejeita string solta — o bug que só apareceria no cálculo de disponibilidade', () => {
    expect(ianaTimezoneSchema.safeParse('Brasilia').success).toBe(false)
    expect(ianaTimezoneSchema.safeParse('GMT-3').success).toBe(false)
    expect(ianaTimezoneSchema.safeParse('').success).toBe(false)
  })

  it('createResource recusa recurso sem fuso válido', () => {
    const result = createResourceSchema.safeParse({ name: 'Sala 1', kind: 'room', timezone: 'Nao/Existe' })

    expect(result.success).toBe(false)
  })
})

describe('dinheiro é centavo inteiro', () => {
  it('rejeita 29.90 — o erro que transformaria vinte e nove reais em vinte e nove centavos', () => {
    const result = createServiceSchema.safeParse({ name: 'Corte', durationMinutes: 30, priceInCents: 29.9 })

    expect(result.success).toBe(false)
  })

  it('rejeita preço negativo', () => {
    expect(createServiceSchema.safeParse({ name: 'Corte', durationMinutes: 30, priceInCents: -1 }).success).toBe(false)
  })

  it('serviço sem priceInCents é válido — nem todo serviço tem preço fixo', () => {
    expect(createServiceSchema.safeParse({ name: 'Consulta', durationMinutes: 30 }).success).toBe(true)
  })
})

describe('faixa de tempo', () => {
  it('rejeita reserva com fim antes ou igual ao início', () => {
    const now = new Date()
    const result = requestBookingSchema.safeParse({
      title: 'Reunião',
      during: { start: now, end: now },
      resourceIds: ['00000000-0000-0000-0000-000000000000'],
    })

    expect(result.success).toBe(false)
  })

  it('aceita reunião com mais de um recurso — é o que diferencia reunião de serviço (spec §5.1)', () => {
    const start = new Date(Date.now() + 60_000)
    const end = new Date(Date.now() + 3_600_000)
    const result = requestBookingSchema.safeParse({
      title: 'Reunião',
      during: { start, end },
      resourceIds: [
        '00000000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-000000000002',
        '00000000-0000-0000-0000-000000000003',
      ],
    })

    expect(result.success).toBe(true)
  })
})

describe('query string chega como texto', () => {
  it('coage página e tamanho, e aplica os defaults', () => {
    const parsed = listBookingsQuerySchema.parse({ page: '2' })

    expect(parsed).toMatchObject({ page: 2, pageSize: 20 })
  })

  it('rejeita status fora do vocabulário em vez de aceitar qualquer string', () => {
    expect(listBookingsQuerySchema.safeParse({ status: 'em_andamento' }).success).toBe(false)
  })
})

describe('acoplamento', () => {
  it('zod é a única dependência de runtime', () => {
    const manifest = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf8'))

    expect(Object.keys(manifest.dependencies ?? {})).toEqual(['zod'])
  })

  it('a porta de calendário externo existe como tipo, sem trazer cliente do Google junto', () => {
    // É o que permite o módulo não carregar OAuth do Google para quem só agenda internamente.
    const providers = readFileSync(join(__dirname, 'providers.ts'), 'utf8')

    expect(providers).toContain('CalendarSyncPort')
    expect(providers).not.toMatch(/^import .*from ['"](?!\.)/m)
  })

  it('CalendarSyncPort já declara o método de leitura, mesmo sem implementação (T1.3)', () => {
    const providers = readFileSync(join(__dirname, 'providers.ts'), 'utf8')

    expect(providers).toContain('readEvents')
  })
})
