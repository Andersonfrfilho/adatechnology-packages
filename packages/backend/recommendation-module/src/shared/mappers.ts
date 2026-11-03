/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import type {
  Campaign,
  CampaignStatus,
  FeedEntry,
  ItemStatus,
  RecommendationItem,
  RecommendationSource,
} from '@adatechnology/recommendation-contracts'

import type { CampaignRow, ItemRow } from '../schema/schema'

/**
 * Alguns drivers devolvem `jsonb` como texto. O módulo não escolhe driver, então lê os dois.
 */
export function readAttributes(value: unknown): Record<string, unknown> {
  if (typeof value === 'string') {
    try {
      const parsed: unknown = JSON.parse(value)
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {}
    } catch {
      return {}
    }
  }
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

/** Idem para `text[]`: há driver que entrega o literal `{a,b}`. */
export function readTextArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((entry): entry is string => typeof entry === 'string')
  if (typeof value === 'string' && value.startsWith('{') && value.endsWith('}')) {
    const inner = value.slice(1, -1)
    if (inner === '') return []
    return inner.split(',').map((entry) => entry.replace(/^"(.*)"$/, '$1'))
  }
  return []
}

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value)
}

export function toItem(row: ItemRow): RecommendationItem {
  return {
    id: row.id,
    kind: row.kind,
    source: row.source as RecommendationSource,
    status: row.status as ItemStatus,
    title: row.title,
    summary: row.summary,
    imageUrl: row.imageUrl,
    linkUrl: row.linkUrl,
    city: row.city,
    state: row.state,
    minAge: row.minAge,
    maxAge: row.maxAge,
    tags: readTextArray(row.tags),
    attributes: readAttributes(row.attributes),
    sponsorId: row.sponsorId,
    createdAt: toDate(row.createdAt),
    updatedAt: toDate(row.updatedAt),
  }
}

export function toCampaign(row: CampaignRow): Campaign {
  return {
    id: row.id,
    itemId: row.itemId,
    plan: row.plan,
    status: row.status as CampaignStatus,
    priority: row.priority,
    startsAt: toDate(row.startsAt),
    endsAt: row.endsAt ? toDate(row.endsAt) : null,
    placements: readTextArray(row.placements),
    externalReference: row.externalReference,
    createdAt: toDate(row.createdAt),
    updatedAt: toDate(row.updatedAt),
  }
}

export function toFeedEntry(item: RecommendationItem, campaign: Campaign | null): FeedEntry {
  return {
    itemId: item.id,
    campaignId: campaign?.id ?? null,
    kind: item.kind,
    sponsored: campaign !== null,
    plan: campaign?.plan ?? null,
    title: item.title,
    summary: item.summary,
    imageUrl: item.imageUrl,
    linkUrl: item.linkUrl,
    city: item.city,
    state: item.state,
    tags: item.tags,
    attributes: item.attributes,
  }
}
