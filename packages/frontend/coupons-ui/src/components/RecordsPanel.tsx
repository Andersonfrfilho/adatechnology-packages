/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Painel genérico de registros de uma campanha (códigos, contatos, usos): barra com busca, filtros,
 * total e exportação; tabela zebrada; paginação. Cada aba só declara colunas e de onde carrega.
 */

import type { ExportFormat, ExportKind, SpreadsheetCell } from '@adatechnology/coupon-contracts'
import type { ReactNode } from 'react'

import type { RecordListController } from '../hooks/useRecordList'
import { buildSpreadsheetBlob, downloadBlob } from '../lib/spreadsheetDownload'
import { useCouponsAdminApi, useCouponsText } from '../providers/CouponsProvider'
import type { ListRecordsParams } from '../providers/types'
import { ExportMenu, type ExportScope } from './ExportMenu'
import { ListToolbar } from './ListToolbar'
import { Pagination } from './Pagination'
import { SortHeader } from './SortHeader'

export type RecordColumn<TRecord> = {
  readonly key: string
  readonly label: string
  readonly render: (record: TRecord) => ReactNode
  /** Valor na planilha (página atual). */
  readonly cell: (record: TRecord) => SpreadsheetCell
  readonly isNumber?: boolean
}

export type RecordsPanelProps<TRecord extends { readonly id: string }> = {
  readonly id: string
  readonly campaignId: string
  readonly exportKind: ExportKind
  readonly list: RecordListController<TRecord>
  readonly columns: readonly RecordColumn<TRecord>[]
  /** A primeira coluna ordena por data (crescente/decrescente). */
  readonly searchPlaceholder: string
  readonly filters?: ReactNode
  readonly above?: ReactNode
  readonly rowActions?: (record: TRecord) => ReactNode
  /** Filtros da aba além da busca (situação, não entregues), repassados à exportação do servidor. */
  readonly exportFilters?: Omit<ListRecordsParams, 'page' | 'pageSize' | 'search' | 'order'>
}

export function RecordsPanel<TRecord extends { readonly id: string }>(props: RecordsPanelProps<TRecord>) {
  const api = useCouponsAdminApi()
  const { messages } = useCouponsText()
  const { list } = props
  const page = list.records.data

  async function handleExport(scope: ExportScope, format: ExportFormat): Promise<void> {
    const fileName = `${props.exportKind}.${format}`
    if (scope === 'all' && api.exportRecords) {
      const blob = await api.exportRecords({
        campaignId: props.campaignId,
        kind: props.exportKind,
        format,
        filters: {
          ...props.exportFilters,
          order: list.state.order,
          ...(list.state.search ? { search: list.state.search } : {}),
        },
      })
      downloadBlob(blob, fileName)
      return
    }
    const table = {
      header: props.columns.map((column) => column.label),
      rows: (page?.data ?? []).map((record) => props.columns.map((column) => column.cell(record))),
    }
    downloadBlob(buildSpreadsheetBlob(table, format), fileName)
  }

  const [first, ...rest] = props.columns
  return (
    <div className="acp-records">
      {props.above}
      <ListToolbar
        id={props.id}
        search={list.state.search}
        searchPlaceholder={props.searchPlaceholder}
        onSearchChange={list.setSearch}
        total={page?.pagination.total}
        hasFilters={list.hasFilters}
        onClearFilters={list.clear}
        {...(props.filters ? { filters: props.filters } : {})}
        actions={<ExportMenu onExport={handleExport} canExportAll={Boolean(api.exportRecords)} />}
      />
      {list.records.error ? (
        <div className="acp-empty" role="alert">
          <p>{messages.loadError}</p>
          <button type="button" className="acp-button acp-button--ghost" onClick={list.records.reload}>
            {messages.retry}
          </button>
        </div>
      ) : !page ? (
        <p className="acp-empty" aria-busy="true">
          {messages.loading}
        </p>
      ) : page.data.length === 0 ? (
        <p className="acp-empty">{messages.empty}</p>
      ) : (
        <div className="acp-table-wrap">
          <table className="acp-table">
            <thead>
              <tr>
                {first ? (
                  <SortHeader label={first.label} direction={list.state.order} onToggle={list.toggleOrder} />
                ) : null}
                {rest.map((column) => (
                  <th key={column.key} scope="col" className={column.isNumber ? 'acp-number' : undefined}>
                    {column.label}
                  </th>
                ))}
                {props.rowActions ? <th scope="col" /> : null}
              </tr>
            </thead>
            <tbody>
              {page.data.map((record) => (
                <tr key={record.id}>
                  {props.columns.map((column) => (
                    <td key={column.key} className={column.isNumber ? 'acp-number' : undefined}>
                      {column.render(record)}
                    </td>
                  ))}
                  {props.rowActions ? <td>{props.rowActions(record)}</td> : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {page ? (
        <Pagination
          id={props.id}
          page={page.pagination.page}
          totalPages={page.pagination.totalPages}
          pageSize={list.state.pageSize}
          onPageChange={list.setPage}
          onPageSizeChange={list.setPageSize}
        />
      ) : null}
    </div>
  )
}
