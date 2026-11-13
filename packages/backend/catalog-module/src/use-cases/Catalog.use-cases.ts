/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import {
  CATALOG_EVENT,
  CatalogNotEmptyError,
  CatalogNotFoundError,
  SectionNotFoundError,
  type Catalog,
  type CreateCatalogInput,
  type CreateSectionInput,
  type PaginatedResponse,
  type Section,
  type UpdateCatalogInput,
  type UpdateSectionInput,
} from '@adatechnology/catalog-contracts'

import type { ListCatalogsQuery } from '../repositories/CatalogRepository'
import { PENDING_SYNC } from '../shared/availability'
import { toCatalog, toPaginated, toSection } from '../shared/toContract'
import { nowOf, runHook, type CatalogDependencies } from './catalogModule.types'

export class CreateCatalogUseCase {
  constructor(private readonly dependencies: CatalogDependencies) {}

  async execute(params: { companyId: string } & CreateCatalogInput): Promise<Catalog> {
    const row = await this.dependencies.catalogs.create({
      companyId: params.companyId,
      name: params.name,
      description: params.description,
      sortOrder: params.sortOrder,
      ...(this.dependencies.config.metaSync?.catalogs ? { syncStatus: PENDING_SYNC } : {}),
    })

    await runHook({
      dependencies: this.dependencies,
      name: CATALOG_EVENT.CATALOG_CREATED,
      run: () =>
        this.dependencies.hooks?.onCatalogCreated?.({
          companyId: params.companyId,
          occurredAt: nowOf(this.dependencies),
          catalogId: row.id,
          name: row.name,
        }),
    })

    return toCatalog(row)
  }
}

export class UpdateCatalogUseCase {
  constructor(private readonly dependencies: CatalogDependencies) {}

  async execute(params: { companyId: string; id: string } & UpdateCatalogInput): Promise<Catalog> {
    const { companyId, id, ...changes } = params
    const row = await this.dependencies.catalogs.update({
      companyId,
      id,
      values: {
        ...changes,
        ...(this.dependencies.config.metaSync?.catalogs && changes.name !== undefined
          ? { syncStatus: PENDING_SYNC }
          : {}),
      },
    })
    if (!row) throw new CatalogNotFoundError(id)
    return toCatalog(row)
  }
}

export class DeleteCatalogUseCase {
  constructor(private readonly dependencies: CatalogDependencies) {}

  async execute(params: { companyId: string; id: string }): Promise<void> {
    const current = await this.dependencies.catalogs.findById(params)
    if (!current) throw new CatalogNotFoundError(params.id)

    /**
     * Recusa com produto dentro. Apagar em cascata sumiria com itens que o operador não pediu
     * para excluir; mover para "sem catálogo" seria decidir por ele. 409 e não 400: o pedido é
     * válido, o estado é que impede.
     */
    const productCount = await this.dependencies.products.countByCatalog({
      companyId: params.companyId,
      catalogId: params.id,
    })
    if (productCount > 0) throw new CatalogNotEmptyError(params.id, productCount)

    await this.dependencies.catalogs.softDelete(params)

    if (this.dependencies.config.metaSync?.catalogs && current.externalId && this.dependencies.metaSync) {
      await this.dependencies.metaSync.deleteProductSet(current.externalId).catch((error: unknown) => {
        this.dependencies.logger?.warn('catalog.meta_unpublish_set_failed', {
          catalogId: params.id,
          error: String(error),
        })
      })
    }

    await runHook({
      dependencies: this.dependencies,
      name: CATALOG_EVENT.CATALOG_DELETED,
      run: () =>
        this.dependencies.hooks?.onCatalogDeleted?.({
          companyId: params.companyId,
          occurredAt: nowOf(this.dependencies),
          catalogId: params.id,
        }),
    })
  }
}

export class ListCatalogsUseCase {
  constructor(private readonly dependencies: CatalogDependencies) {}

  async execute(query: ListCatalogsQuery): Promise<PaginatedResponse<Catalog>> {
    const page = await this.dependencies.catalogs.list(query)
    return toPaginated({
      rows: page.rows,
      total: page.total,
      page: query.page,
      pageSize: query.pageSize,
      map: toCatalog,
    })
  }
}

export class CreateSectionUseCase {
  constructor(private readonly dependencies: CatalogDependencies) {}

  async execute(params: { companyId: string } & CreateSectionInput): Promise<Section> {
    const row = await this.dependencies.sections.create({
      companyId: params.companyId,
      name: params.name,
      catalogId: params.catalogId,
      sortOrder: params.sortOrder,
    })
    return toSection(row)
  }
}

export class UpdateSectionUseCase {
  constructor(private readonly dependencies: CatalogDependencies) {}

  async execute(params: { companyId: string; id: string } & UpdateSectionInput): Promise<Section> {
    const { companyId, id, ...changes } = params
    const row = await this.dependencies.sections.update({ companyId, id, values: changes })
    if (!row) throw new SectionNotFoundError(id)
    return toSection(row)
  }
}

export class DeleteSectionUseCase {
  constructor(private readonly dependencies: CatalogDependencies) {}

  async execute(params: { companyId: string; id: string }): Promise<void> {
    // Sem checagem de produtos: `products.sectionId` é `ON DELETE SET NULL`, então o item
    // sobrevive sem seção. Diferente de catálogo, seção não organiza a vitrine do cliente — é
    // roteamento interno de produção.
    const deleted = await this.dependencies.sections.delete(params)
    if (!deleted) throw new SectionNotFoundError(params.id)
  }
}

export class ListSectionsUseCase {
  constructor(private readonly dependencies: CatalogDependencies) {}

  async execute(params: { companyId: string; catalogId?: string }): Promise<readonly Section[]> {
    const rows = await this.dependencies.sections.listByCompany(params)
    return rows.map(toSection)
  }
}
