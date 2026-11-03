/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'

import type { KindDefinition } from '../providers/types'
import {
  buildCampaignPayload,
  buildItemPayload,
  clickRate,
  emptyDraft,
  last30Days,
  parseTags,
  toUpdatePayload,
} from './itemDraft'

const place: KindDefinition = {
  name: 'place',
  label: 'Lugar',
  fields: [
    {
      name: 'category',
      label: 'Categoria',
      type: 'select',
      required: true,
      options: [{ value: 'parque', label: 'Parque' }],
    },
    { name: 'price', label: 'Preço', type: 'number', required: false },
    { name: 'free', label: 'Gratuito', type: 'boolean', required: false },
  ],
}

describe('buildItemPayload', () => {
  it('monta o corpo com campos vazios como null e tags normalizadas', () => {
    const draft = {
      ...emptyDraft(place),
      title: ' Parque ',
      tags: 'Ar livre, ar livre, ',
      attributes: { category: 'parque', price: '12,5', free: true },
    }
    const { payload, errors } = buildItemPayload({ draft, kind: place })
    expect(errors).toEqual([])
    expect(payload).toMatchObject({
      kind: 'place',
      title: 'Parque',
      summary: null,
      linkUrl: null,
      tags: ['ar livre'],
      attributes: { category: 'parque', price: 12.5, free: true },
      sponsorId: null,
    })
  })

  it('aponta os erros no campo', () => {
    const draft = {
      ...emptyDraft(place),
      source: 'sponsored' as const,
      linkUrl: 'javascript:alert(1)',
      minAge: '10',
      maxAge: '3',
    }
    const fields = buildItemPayload({ draft, kind: place }).errors.map((error) => error.field)
    expect(fields).toEqual(['title', 'linkUrl', 'sponsorId', 'minAge', 'attributes.category'])
  })

  it('edição não manda tipo nem origem', () => {
    const { payload } = buildItemPayload({ draft: { ...emptyDraft(place), title: 'X' }, kind: place })
    expect(toUpdatePayload(payload)).not.toHaveProperty('kind')
    expect(toUpdatePayload(payload)).not.toHaveProperty('source')
  })
})

describe('buildCampaignPayload', () => {
  it('recusa fim antes do início', () => {
    const { errors } = buildCampaignPayload({
      plan: 'featured',
      priority: '',
      startsAt: '2026-11-10T10:00',
      endsAt: '2026-11-01T10:00',
      placements: [],
    })
    expect(errors.map((error) => error.field)).toEqual(['endsAt'])
  })

  it('converte datas para ISO e prioridade vazia para 0', () => {
    const { payload, errors } = buildCampaignPayload({
      plan: 'featured',
      priority: '',
      startsAt: '2026-11-10T10:00',
      endsAt: '',
      placements: ['home'],
    })
    expect(errors).toEqual([])
    expect(payload.priority).toBe(0)
    expect(payload.endsAt).toBeNull()
    expect(payload.startsAt).toMatch(/^2026-11-10T/)
  })
})

describe('utilidades', () => {
  it('parseTags tira repetidas e vazias', () => {
    expect(parseTags('A, b ,a,,')).toEqual(['a', 'b'])
  })

  it('taxa de clique em pt-BR, e traço sem impressão', () => {
    expect(clickRate(200, 3)).toBe('1,5%')
    expect(clickRate(0, 0)).toBe('-')
  })

  it('últimos 30 dias incluem hoje', () => {
    expect(last30Days(new Date(2026, 10, 30))).toEqual({ from: '2026-11-01', to: '2026-11-30' })
  })
})
