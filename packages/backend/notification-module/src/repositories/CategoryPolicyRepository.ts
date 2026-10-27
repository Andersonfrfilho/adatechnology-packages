/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { and, eq, inArray } from 'drizzle-orm'

import type { NotificationDatabase } from '../database.types'
import { categoryPolicies, type CategoryPolicyRow } from '../schema/schema'

export type CategoryPolicyInput = {
  readonly category: string
  readonly channel: string
  readonly enabled: boolean
}

export class CategoryPolicyRepository {
  constructor(private readonly db: NotificationDatabase) {}

  async listByCompany(params: { companyId: string }): Promise<CategoryPolicyRow[]> {
    return this.db.select().from(categoryPolicies).where(eq(categoryPolicies.companyId, params.companyId))
  }

  async listByCategory(params: { companyId: string; category: string }): Promise<CategoryPolicyRow[]> {
    return this.db
      .select()
      .from(categoryPolicies)
      .where(and(eq(categoryPolicies.companyId, params.companyId), eq(categoryPolicies.category, params.category)))
  }

  /**
   * Substitui o conjunto das categorias tocadas, numa transação.
   *
   * Só as categorias presentes no lote são afetadas: apagar tudo e reinserir faria a tela que
   * edita uma aba desligar as políticas de todas as outras.
   */
  async replace(params: { companyId: string; policies: readonly CategoryPolicyInput[] }): Promise<CategoryPolicyRow[]> {
    const categories = [...new Set(params.policies.map((policy) => policy.category))]
    if (categories.length === 0) return []

    return this.db.transaction(async (transaction) => {
      await transaction
        .delete(categoryPolicies)
        .where(and(eq(categoryPolicies.companyId, params.companyId), inArray(categoryPolicies.category, categories)))

      return transaction
        .insert(categoryPolicies)
        .values(
          params.policies.map((policy) => ({
            companyId: params.companyId,
            category: policy.category,
            channel: policy.channel,
            enabled: policy.enabled,
          })),
        )
        .returning()
    })
  }
}
