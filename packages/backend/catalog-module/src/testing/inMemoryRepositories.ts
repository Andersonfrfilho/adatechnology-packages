/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Dublês em memória para a suíte de comportamento. O isolamento multiempresa real (cláusula SQL)
 * é coberto por `repositories/isolation.test.ts`, que renderiza SQL de verdade — aqui o foco é a
 * lógica de disponibilidade, evento de esgotado e importação em lote.
 */

import { randomUUID } from 'node:crypto'
import { InsufficientInventoryError } from '@adatechnology/catalog-contracts'

import type { CatalogRow, NewCatalogRow, NewProductRow, NewSectionRow, ProductRow, SectionRow } from '../schema/schema'

const EPOCH = new Date('2026-08-02T12:00:00.000Z')

/**
 * Leitura devolve **cópia**, não referência da linha guardada.
 *
 * Um `SELECT` real entrega um objeto novo, e o código de produção conta com isso: `ConsumeInventory`
 * lê o saldo anterior, desconta, e compara os dois para saber se **este** consumo foi o que zerou.
 * Um dublê que devolvesse a referência viva faria o "anterior" mudar sozinho junto com o update, e
 * a comparação nunca detectaria a transição — o teste passaria a mentir sobre um código correto.
 */
function snapshot<TRow>(row: TRow | undefined): TRow | undefined {
  return row ? { ...row } : undefined
}

function matchesSearch(row: ProductRow, search: string): boolean {
  const term = search.toLowerCase()
  if (row.name.toLowerCase().includes(term)) return true
  if (row.brand?.toLowerCase().includes(term)) return true
  return (row.aliases ?? []).some((alias) => alias.toLowerCase() === term)
}

export function createInMemoryProducts(seed: ProductRow[] = []) {
  const rows: ProductRow[] = [...seed]

  return {
    rows,
    async create(values: NewProductRow): Promise<ProductRow> {
      const row = {
        id: randomUUID(),
        catalogId: null,
        sectionId: null,
        description: null,
        costPriceInCents: null,
        unit: null,
        unitSize: null,
        brand: null,
        aisle: null,
        aliases: [],
        barcode: null,
        imageUrl: null,
        imageStorageKey: null,
        inventory: null,
        active: true,
        sortOrder: 0,
        availability: 'in stock',
        preparationTimeMinutes: null,
        preparationInstructions: null,
        externalId: null,
        syncStatus: null,
        syncError: null,
        deletedAt: null,
        createdAt: EPOCH,
        updatedAt: EPOCH,
        ...values,
      } as ProductRow
      rows.push(row)
      return row
    },
    async findById(params: { companyId: string; id: string }): Promise<ProductRow | undefined> {
      return snapshot(rows.find((row) => row.companyId === params.companyId && row.id === params.id && !row.deletedAt))
    },
    async findByBarcode(params: { companyId: string; barcode: string }): Promise<ProductRow | undefined> {
      return snapshot(
        rows.find((row) => row.companyId === params.companyId && row.barcode === params.barcode && !row.deletedAt),
      )
    },
    async list(query: { companyId: string; page: number; pageSize: number; search?: string; active?: boolean }) {
      const filtered = rows.filter(
        (row) =>
          row.companyId === query.companyId &&
          !row.deletedAt &&
          // Mesmo alcance do `productSearchCondition` no Postgres: nome e marca por trecho, apelido
          // inteiro. O dublê que só casasse nome deixaria passar uma regressão na busca por apelido.
          (query.search ? matchesSearch(row, query.search) : true) &&
          (query.active === undefined ? true : row.active === query.active),
      )
      return {
        rows: filtered.slice((query.page - 1) * query.pageSize, query.page * query.pageSize),
        total: filtered.length,
      }
    },
    async update(params: {
      companyId: string
      id: string
      values: Partial<NewProductRow>
    }): Promise<ProductRow | undefined> {
      const row = rows.find(
        (candidate) => candidate.companyId === params.companyId && candidate.id === params.id && !candidate.deletedAt,
      )
      if (!row) return undefined
      Object.assign(row, params.values)
      return snapshot(row)
    },
    async softDelete(params: { companyId: string; id: string }): Promise<boolean> {
      const row = rows.find((candidate) => candidate.companyId === params.companyId && candidate.id === params.id)
      if (!row) return false
      row.deletedAt = EPOCH
      return true
    },
    async countByCatalog(params: { companyId: string; catalogId: string }): Promise<number> {
      return rows.filter(
        (row) => row.companyId === params.companyId && row.catalogId === params.catalogId && !row.deletedAt,
      ).length
    },
    /**
     * Reproduz a semântica do `UPDATE ... WHERE inventory >= quantity`: a checagem e o desconto
     * acontecem **juntos**, sem ponto de suspensão entre ler e gravar. É o que permite o teste de
     * concorrência ser honesto — se este dublê lesse e depois gravasse, o teste passaria mesmo
     * com um repositório real defeituoso.
     */
    async consumeInventory(params: {
      companyId: string
      id: string
      quantity: number
    }): Promise<{ remaining: number }> {
      const row = rows.find(
        (candidate) => candidate.companyId === params.companyId && candidate.id === params.id && !candidate.deletedAt,
      )
      if (!row) throw new InsufficientInventoryError(params.id, 0, params.quantity)
      if (row.inventory === null) return { remaining: Number.POSITIVE_INFINITY }
      if (row.inventory < params.quantity)
        throw new InsufficientInventoryError(params.id, row.inventory, params.quantity)

      row.inventory -= params.quantity
      return { remaining: row.inventory }
    },
    async listBySyncStatus(params: { companyId: string; syncStatus: string; limit: number }): Promise<ProductRow[]> {
      return rows
        .filter((row) => row.companyId === params.companyId && row.syncStatus === params.syncStatus && !row.deletedAt)
        .slice(0, params.limit)
        .map((row) => ({ ...row }))
    },
    async markSync(params: {
      companyId: string
      id: string
      syncStatus: string
      externalId?: string
      syncError?: string | null
    }): Promise<void> {
      const row = rows.find((candidate) => candidate.companyId === params.companyId && candidate.id === params.id)
      if (!row) return
      row.syncStatus = params.syncStatus
      if (params.externalId !== undefined) row.externalId = params.externalId
      row.syncError = params.syncError ?? null
    },
  }
}

export function createInMemoryCatalogs(seed: CatalogRow[] = []) {
  const rows: CatalogRow[] = [...seed]

  return {
    rows,
    async create(values: NewCatalogRow): Promise<CatalogRow> {
      const row = {
        id: randomUUID(),
        description: null,
        active: true,
        sortOrder: 0,
        externalId: null,
        syncStatus: null,
        syncError: null,
        deletedAt: null,
        createdAt: EPOCH,
        updatedAt: EPOCH,
        ...values,
      } as CatalogRow
      rows.push(row)
      return row
    },
    async findById(params: { companyId: string; id: string }) {
      return snapshot(rows.find((row) => row.companyId === params.companyId && row.id === params.id && !row.deletedAt))
    },
    async list(query: { companyId: string; page: number; pageSize: number; search?: string }) {
      const filtered = rows.filter(
        (row) =>
          row.companyId === query.companyId &&
          !row.deletedAt &&
          (query.search ? row.name.toLowerCase().includes(query.search.toLowerCase()) : true),
      )
      return { rows: filtered.map((row) => ({ ...row, productCount: 0 })), total: filtered.length }
    },
    async update(params: { companyId: string; id: string; values: Partial<NewCatalogRow> }) {
      const row = rows.find((candidate) => candidate.companyId === params.companyId && candidate.id === params.id)
      if (!row) return undefined
      Object.assign(row, params.values)
      return snapshot(row)
    },
    async softDelete(params: { companyId: string; id: string }) {
      const row = rows.find((candidate) => candidate.companyId === params.companyId && candidate.id === params.id)
      if (!row) return false
      row.deletedAt = EPOCH
      return true
    },
    async markSync(params: {
      companyId: string
      id: string
      syncStatus: string
      externalId?: string
      syncError?: string | null
    }): Promise<void> {
      const row = rows.find((candidate) => candidate.companyId === params.companyId && candidate.id === params.id)
      if (!row) return
      row.syncStatus = params.syncStatus
      if (params.externalId !== undefined) row.externalId = params.externalId
      row.syncError = params.syncError ?? null
    },
  }
}

export function createInMemorySections(seed: SectionRow[] = []) {
  const rows: SectionRow[] = [...seed]

  return {
    rows,
    async create(values: NewSectionRow): Promise<SectionRow> {
      const row = {
        id: randomUUID(),
        catalogId: null,
        sortOrder: 0,
        createdAt: EPOCH,
        updatedAt: EPOCH,
        ...values,
      } as SectionRow
      rows.push(row)
      return row
    },
    async findById(params: { companyId: string; id: string }) {
      return snapshot(rows.find((row) => row.companyId === params.companyId && row.id === params.id))
    },
    async listByCompany(params: { companyId: string; catalogId?: string }) {
      return rows.filter(
        (row) =>
          row.companyId === params.companyId &&
          (params.catalogId ? row.catalogId === params.catalogId || row.catalogId === null : true),
      )
    },
    async update(params: { companyId: string; id: string; values: Partial<NewSectionRow> }) {
      const row = rows.find((candidate) => candidate.companyId === params.companyId && candidate.id === params.id)
      if (!row) return undefined
      Object.assign(row, params.values)
      return snapshot(row)
    },
    async delete(params: { companyId: string; id: string }) {
      const index = rows.findIndex((row) => row.companyId === params.companyId && row.id === params.id)
      if (index === -1) return false
      rows.splice(index, 1)
      return true
    },
  }
}
