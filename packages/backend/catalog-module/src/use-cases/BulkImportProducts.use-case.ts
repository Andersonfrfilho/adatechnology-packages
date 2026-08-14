/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Importação em lote. Recebe **linhas já extraídas**, não o arquivo: parsear XLSX exigiria uma
 * dependência pesada (`xlsx` passa de 7 MB) que só serve a quem importa planilha, e o host já tem
 * o parser dele. CSV/XLSX → `BulkImportRow[]` é do host; validar, converter e gravar é daqui.
 */

import { CATALOG_EVENT, bulkImportRowSchema } from '@adatechnology/catalog-contracts'
import type { BulkImportResult, BulkImportRowError } from '@adatechnology/catalog-contracts'

import { parsePriceToCents } from '../shared/parsePrice'
import { nowOf, runHook, type CatalogDependencies } from './catalogModule.types'
import type { CreateProductUseCase } from './Product.use-cases'

export type BulkImportParams = {
  readonly companyId: string
  readonly rows: readonly unknown[]
}

/** Acima disso o host deve mandar para fila (§9 Q3 da spec) — aqui só o aviso no log. */
const SYNCHRONOUS_ROW_LIMIT = 500

export class BulkImportProductsUseCase {
  constructor(
    private readonly dependencies: CatalogDependencies,
    private readonly createProduct: CreateProductUseCase,
  ) {}

  async execute(params: BulkImportParams): Promise<BulkImportResult> {
    if (params.rows.length > SYNCHRONOUS_ROW_LIMIT) {
      this.dependencies.logger?.warn('catalog.bulk_import.large_batch', {
        rows: params.rows.length,
        limit: SYNCHRONOUS_ROW_LIMIT,
      })
    }

    const errors: BulkImportRowError[] = []
    let succeeded = 0

    // Cache de catálogo e seção por nome: uma planilha de 5 mil linhas costuma repetir as mesmas
    // 20 categorias, e resolver por nome a cada linha faria 5 mil consultas para 20 respostas.
    const catalogIdByName = new Map<string, string | undefined>()
    const sectionIdByName = new Map<string, string | undefined>()

    for (const [index, raw] of params.rows.entries()) {
      // Número da linha na PLANILHA (1 = cabeçalho), não índice do array — é o que o operador vê
      // ao abrir o arquivo para corrigir.
      const rowNumber = index + 2

      const parsed = bulkImportRowSchema.safeParse(raw)
      if (!parsed.success) {
        errors.push({ row: rowNumber, message: parsed.error.issues.map((issue) => issue.message).join('; ') })
        continue
      }

      const price = parsePriceToCents(parsed.data.price, this.dependencies.config.locale)
      if (!price.ok) {
        errors.push({ row: rowNumber, message: price.reason })
        continue
      }

      try {
        // criaria corrida no cache de catálogo/seção por nome (duas linhas da mesma categoria
        // criariam duas categorias) e dispararia N inserts simultâneos contra o pool do host.
        const catalogId = await this.resolveCatalogId({
          companyId: params.companyId,
          name: parsed.data.catalogName,
          cache: catalogIdByName,
        })

        const sectionId = await this.resolveSectionId({
          companyId: params.companyId,
          name: parsed.data.sectionName,
          catalogId,
          cache: sectionIdByName,
        })

        await this.createProduct.execute({
          companyId: params.companyId,
          name: parsed.data.name,
          description: parsed.data.description,
          priceInCents: price.cents,
          unit: parsed.data.unit,
          unitSize: parsed.data.unitSize,
          brand: parsed.data.brand,
          aisle: parsed.data.aisle,
          barcode: parsed.data.barcode,
          catalogId,
          sectionId,
          inventory: parsed.data.inventory === undefined ? undefined : Number(parsed.data.inventory),
        })
        succeeded += 1
      } catch (error) {
        // Uma linha ruim não derruba as outras — o relatório por linha é o produto deste
        // use-case, e abortar no primeiro erro obrigaria o operador a corrigir de um em um.
        errors.push({ row: rowNumber, message: error instanceof Error ? error.message : String(error) })
      }
    }

    await runHook({
      dependencies: this.dependencies,
      name: CATALOG_EVENT.BULK_IMPORT_FINISHED,
      run: () =>
        this.dependencies.hooks?.onBulkImportFinished?.({
          companyId: params.companyId,
          occurredAt: nowOf(this.dependencies),
          succeeded,
          failed: errors.length,
        }),
    })

    return { succeeded, failed: errors.length, errors }
  }

  private async resolveCatalogId(params: {
    companyId: string
    name?: string
    cache: Map<string, string | undefined>
  }): Promise<string | undefined> {
    if (!params.name) return undefined
    if (params.cache.has(params.name)) return params.cache.get(params.name)

    const existing = await this.dependencies.catalogs.list({
      companyId: params.companyId,
      page: 1,
      pageSize: 1,
      search: params.name,
    })
    const match = existing.rows.find((row) => row.name.toLowerCase() === params.name?.toLowerCase())

    // Cria o catálogo que a planilha menciona e não existe — importar 3 mil itens e depois ter de
    // criar 20 categorias à mão anularia o ganho da importação.
    const id =
      match?.id ?? (await this.dependencies.catalogs.create({ companyId: params.companyId, name: params.name })).id
    params.cache.set(params.name, id)
    return id
  }

  private async resolveSectionId(params: {
    companyId: string
    name?: string
    catalogId?: string
    cache: Map<string, string | undefined>
  }): Promise<string | undefined> {
    if (!params.name) return undefined
    const cacheKey = `${params.catalogId ?? ''}:${params.name}`
    if (params.cache.has(cacheKey)) return params.cache.get(cacheKey)

    const existing = await this.dependencies.sections.listByCompany({
      companyId: params.companyId,
      catalogId: params.catalogId,
    })
    const match = existing.find((row) => row.name.toLowerCase() === params.name?.toLowerCase())

    const id =
      match?.id ??
      (
        await this.dependencies.sections.create({
          companyId: params.companyId,
          name: params.name,
          catalogId: params.catalogId,
        })
      ).id
    params.cache.set(cacheKey, id)
    return id
  }
}
