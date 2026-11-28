/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { CAMPAIGN_STATES, type CampaignListItem, type ExportFormat } from '@adatechnology/coupon-contracts'
import { Plus } from 'lucide-react'
import { useState } from 'react'

import { useCampaignList } from '../hooks/useCampaignList'
import { buildCampaignTable } from '../lib/campaignSpreadsheet'
import { buildSpreadsheetBlob, downloadBlob } from '../lib/spreadsheetDownload'
import { useCouponsAdminApi, useCouponsText } from '../providers/CouponsProvider'
import { CampaignTable } from './CampaignTable'
import { ExportMenu, type ExportScope } from './ExportMenu'
import { FilterChips } from './FilterChips'
import { ListToolbar } from './ListToolbar'
import { Pagination } from './Pagination'
import { STATE_LABEL_KEY } from '../lib/labels'

const EXPORT_PAGE_SIZE = 100

export type CampaignListProps = {
  readonly onOpen: (campaign: CampaignListItem) => void
  readonly onCreate?: () => void
  readonly reloadKey?: number
  readonly syncUrl?: boolean
  /** Só leitura: sem seleção em lote (ativar/desativar). */
  readonly readOnly?: boolean
}

export function CampaignList({ onOpen, onCreate, reloadKey, syncUrl, readOnly = false }: CampaignListProps) {
  const api = useCouponsAdminApi()
  const { messages, format } = useCouponsText()
  const list = useCampaignList({ ...(syncUrl ? { syncUrl } : {}), ...(reloadKey === undefined ? {} : { reloadKey }) })
  const [batchMessage, setBatchMessage] = useState<string>()
  const page = list.campaigns.data
  const now = new Date()

  async function handleExport(scope: ExportScope, fileFormat: ExportFormat): Promise<void> {
    let campaigns = page?.data ?? []
    if (scope === 'all') {
      const collected: CampaignListItem[] = []
      const query = {
        search: list.state.search,
        states: list.state.states,
        sort: list.state.sort,
        order: list.state.order,
      }
      for (let pageNumber = 1; ; pageNumber += 1) {
        const result = await api.listCampaigns({ ...query, page: pageNumber, pageSize: EXPORT_PAGE_SIZE })
        collected.push(...result.data)
        if (pageNumber >= result.pagination.totalPages) break
      }
      campaigns = collected
    }
    downloadBlob(
      buildSpreadsheetBlob(buildCampaignTable({ campaigns, messages, now }), fileFormat),
      `campanhas.${fileFormat}`,
    )
  }

  async function handleBatch(isActive: boolean): Promise<void> {
    const ids = [...list.selectedIds]
    // Cada uma segue sozinha: falhar uma não impede as outras.
    const results = await Promise.allSettled(ids.map((id) => api.updateCampaign(id, { isActive })))
    setBatchMessage(
      format('batchDone', {
        done: results.filter((result) => result.status === 'fulfilled').length,
        total: ids.length,
      }),
    )
    list.campaigns.reload()
  }

  return (
    <section className="acp-root acp-list" aria-labelledby="acp-campaigns-title">
      <h2 id="acp-campaigns-title" className="acp-title">
        {messages.workspaceTitle}
      </h2>
      <ListToolbar
        id="acp-campaigns"
        search={list.state.search}
        searchPlaceholder={messages.searchPlaceholder}
        onSearchChange={list.setSearch}
        total={page?.pagination.total}
        hasFilters={list.hasFilters}
        onClearFilters={list.clearFilters}
        filters={
          <FilterChips
            label={messages.filterState}
            options={CAMPAIGN_STATES.map((state) => ({ value: state, label: messages[STATE_LABEL_KEY[state]] }))}
            selected={list.state.states}
            onChange={list.setStates}
          />
        }
        actions={
          <>
            <ExportMenu onExport={handleExport} canExportAll />
            {onCreate ? (
              <button type="button" className="acp-button" onClick={onCreate}>
                <Plus aria-hidden="true" className="acp-icon" />
                <span>{messages.newCampaign}</span>
              </button>
            ) : null}
          </>
        }
      />
      {list.selectedIds.size > 0 && !readOnly ? (
        <div
          className="acp-batch-bar"
          role="region"
          aria-label={format('selectedCount', { count: list.selectedIds.size })}
        >
          <span>{format('selectedCount', { count: list.selectedIds.size })}</span>
          <button type="button" className="acp-button acp-button--ghost" onClick={() => void handleBatch(true)}>
            {messages.batchActivate}
          </button>
          <button type="button" className="acp-button acp-button--ghost" onClick={() => void handleBatch(false)}>
            {messages.batchDeactivate}
          </button>
        </div>
      ) : null}
      {batchMessage ? (
        <p role="status" className="acp-status">
          {batchMessage}
        </p>
      ) : null}
      {list.campaigns.error ? (
        <div className="acp-empty" role="alert">
          <p>{messages.loadError}</p>
          <button type="button" className="acp-button acp-button--ghost" onClick={list.campaigns.reload}>
            {messages.retry}
          </button>
        </div>
      ) : !page ? (
        <p className="acp-empty" aria-busy="true">
          {messages.loading}
        </p>
      ) : page.data.length === 0 ? (
        <p className="acp-empty">{list.hasFilters ? messages.empty : messages.emptyCampaigns}</p>
      ) : (
        <CampaignTable
          campaigns={page.data}
          state={list.state}
          selectedIds={list.selectedIds}
          now={now}
          onToggleSort={list.toggleSort}
          onToggleSelected={list.toggleSelected}
          onSelectAll={list.setSelectedIds}
          onOpen={onOpen}
        />
      )}
      {page ? (
        <Pagination
          id="acp-campaigns"
          page={page.pagination.page}
          totalPages={page.pagination.totalPages}
          pageSize={list.state.pageSize}
          onPageChange={list.setPage}
          onPageSizeChange={list.setPageSize}
        />
      ) : null}
    </section>
  )
}
