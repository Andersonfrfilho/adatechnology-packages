/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * O teto de canais da empresa por categoria. Ver `schema.ts` (`categoryPolicies`) para por que
 * linha ausente significa permitido.
 */

import type { NotificationCategoryPolicy } from '@adatechnology/notification-contracts'

import type { CategoryPolicyInput, CategoryPolicyRepository } from '../repositories/CategoryPolicyRepository'
import type { CategoryPolicyRow } from '../schema/schema'

function toCategoryPolicy(row: CategoryPolicyRow): NotificationCategoryPolicy {
  return {
    category: row.category,
    channel: row.channel as NotificationCategoryPolicy['channel'],
    enabled: row.enabled,
  }
}

export class GetCategoryPoliciesUseCase {
  constructor(private readonly policies: CategoryPolicyRepository) {}

  async execute(params: { companyId: string }): Promise<NotificationCategoryPolicy[]> {
    const rows = await this.policies.listByCompany(params)
    return rows.map(toCategoryPolicy)
  }
}

export class UpdateCategoryPoliciesUseCase {
  constructor(private readonly policies: CategoryPolicyRepository) {}

  async execute(params: {
    companyId: string
    policies: readonly CategoryPolicyInput[]
  }): Promise<NotificationCategoryPolicy[]> {
    const rows = await this.policies.replace(params)
    return rows.map(toCategoryPolicy)
  }
}
