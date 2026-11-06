/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * A regra que o anunciante paga para entender.
 */

import { describe, expect, it } from 'bun:test'

import type { FeedEntry } from '@adatechnology/recommendation-contracts'

import { rankFeed } from './rankFeed'

function entry(itemId: string, overrides: Partial<FeedEntry> = {}): FeedEntry {
  return {
    itemId,
    campaignId: null,
    kind: 'place',
    sponsored: false,
    plan: null,
    title: itemId,
    summary: null,
    imageUrl: null,
    linkUrl: null,
    city: null,
    state: null,
    tags: [],
    attributes: {},
    ...overrides,
  }
}

function sponsored(itemId: string, planWeight: number, priority = 0, campaignId = `c-${itemId}`) {
  return { entry: entry(itemId, { sponsored: true, campaignId }), planWeight, priority }
}

const day = (n: number) => new Date(Date.UTC(2026, 10, n))
const fixed = () => 0.5

describe('rankFeed', () => {
  it('patrocinado vem primeiro, pelo peso do plano e depois pela prioridade', () => {
    const result = rankFeed({
      sponsored: [sponsored('basico', 1, 9), sponsored('destaque', 10, 0), sponsored('destaque-forte', 10, 5)],
      curated: [{ entry: entry('curado'), updatedAt: day(1) }],
      limit: 10,
      maxSponsored: 3,
      random: fixed,
    })
    expect(result.map((e) => e.itemId)).toEqual(['destaque-forte', 'destaque', 'basico', 'curado'])
  })

  it('respeita o teto de patrocinados do espaço', () => {
    const result = rankFeed({
      sponsored: [sponsored('a', 10), sponsored('b', 5), sponsored('c', 1)],
      curated: [{ entry: entry('curado'), updatedAt: day(1) }],
      limit: 10,
      maxSponsored: 2,
      random: fixed,
    })
    expect(result.map((e) => e.itemId)).toEqual(['a', 'b', 'curado'])
  })

  it('item com duas campanhas no ar aparece uma vez, pela melhor', () => {
    const result = rankFeed({
      sponsored: [sponsored('a', 1, 0, 'barata'), sponsored('a', 10, 0, 'cara')],
      curated: [],
      limit: 10,
      maxSponsored: 5,
      random: fixed,
    })
    expect(result).toHaveLength(1)
    expect(result[0]?.campaignId).toBe('cara')
  })

  it('empate de plano e prioridade é decidido pelo sorteio — o rodízio', () => {
    const draws = [0.9, 0.1]
    const result = rankFeed({
      sponsored: [sponsored('primeiro', 10), sponsored('segundo', 10)],
      curated: [],
      limit: 1,
      maxSponsored: 1,
      random: () => draws.shift() ?? 0,
    })
    expect(result.map((e) => e.itemId)).toEqual(['segundo'])
  })

  it('curadoria: mais tags em comum primeiro, depois a mais recente', () => {
    const result = rankFeed({
      sponsored: [],
      curated: [
        { entry: entry('recente'), updatedAt: day(20) },
        { entry: entry('antigo-com-tag', { tags: ['parque', 'gratis'] }), updatedAt: day(1) },
        { entry: entry('uma-tag', { tags: ['parque'] }), updatedAt: day(10) },
      ],
      limit: 10,
      maxSponsored: 0,
      tags: ['parque', 'gratis'],
      random: fixed,
    })
    expect(result.map((e) => e.itemId)).toEqual(['antigo-com-tag', 'uma-tag', 'recente'])
  })

  it('não repete item que é patrocinado e curado ao mesmo tempo, e corta no limite', () => {
    const result = rankFeed({
      sponsored: [sponsored('a', 10)],
      curated: [
        { entry: entry('a'), updatedAt: day(3) },
        { entry: entry('b'), updatedAt: day(2) },
        { entry: entry('c'), updatedAt: day(1) },
      ],
      limit: 2,
      maxSponsored: 2,
      random: fixed,
    })
    expect(result.map((e) => e.itemId)).toEqual(['a', 'b'])
  })
})
