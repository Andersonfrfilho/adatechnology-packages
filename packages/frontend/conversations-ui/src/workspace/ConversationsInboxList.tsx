/**
 * Coluna da esquerda: busca, filtros de janela e canal, seleção em massa, linhas e paginação.
 *
 * Recebe o resultado do hook inteiro em vez de vinte props: é a mesma máquina de estado, e passar
 * peça por peça só criaria oportunidade de um produto ligar metade dos controles.
 */

import type { ReactNode } from 'react'

import { ChannelIcon } from '../ChannelIcon'
import { ConversationRow } from '../ConversationRow'
import { CHANNEL_FILTER_ALL } from '../conversationChannel'
import { WINDOW_FILTERS } from '../conversationWindow'
import type { ConversationSummary } from '../providers/types'
import type { ConversationsWorkspaceLabels } from './labels'
import type { UseConversationsInboxResult } from './useConversationsInbox'
import { PAGINATION_LABELS } from '../pagination.constant'

export interface ConversationsInboxListProps {
  readonly inbox: UseConversationsInboxResult
  readonly labels: ConversationsWorkspaceLabels
  readonly className?: string
  /** Barra extra do produto acima da lista (ex.: filtro de carteira, seletor de campanha). */
  readonly renderFilters?: (inbox: UseConversationsInboxResult) => ReactNode
  /** Ações em lote do produto, ao lado de finalizar e template. */
  readonly renderBulkActions?: (inbox: UseConversationsInboxResult) => ReactNode
  readonly renderRow?: (conversation: ConversationSummary) => ReactNode
  readonly onSendTemplateToSelected?: () => void
}

export function ConversationsInboxList({
  inbox,
  labels,
  className,
  renderFilters,
  renderBulkActions,
  renderRow,
  onSendTemplateToSelected,
}: ConversationsInboxListProps) {
  const hasSelection = inbox.selectedIds.size > 0

  return (
    <aside className={className}>
      {hasSelection ? (
        <div className="cv-workspace-bulk">
          <span className="cv-workspace-bulk__count">{labels.bulkSelected(inbox.selectedIds.size)}</span>
          <div className="cv-workspace-bulk__actions">
            <button data-cv-tooltip={labels.bulkClear} aria-label={labels.bulkClear} type="button" onClick={inbox.clearBulkSelection}>
              {labels.bulkClear}
            </button>
            {onSendTemplateToSelected ? (
              <button data-cv-tooltip={labels.bulkTemplate} aria-label={labels.bulkTemplate} type="button" onClick={onSendTemplateToSelected} disabled={inbox.busy}>
                {labels.bulkTemplate}
              </button>
            ) : null}
            {inbox.canFinalize ? (
              <button
                data-cv-tooltip={labels.bulkFinalize} aria-label={labels.bulkFinalize}
                type="button"
                disabled={inbox.busy}
                onClick={() => {
                  // Confirmação porque finalizar em lote não tem desfazer: encerra o atendimento de
                  // todas as conversas marcadas de uma vez.
                  if (window.confirm(labels.bulkFinalizeConfirm(inbox.selectedIds.size))) {
                    void inbox.finalizeSelected()
                  }
                }}
              >
                {labels.bulkFinalize}
              </button>
            ) : null}
            {renderBulkActions?.(inbox)}
          </div>
        </div>
      ) : null}

      <div className="cv-workspace-filters">
        <input
          type="search"
          value={inbox.search}
          onChange={(event) => inbox.setSearch(event.target.value)}
          placeholder={labels.search}
          className="cv-workspace-search"
        />

        <div className="cv-workspace-chips">
          <span className="cv-workspace-chips__legend">{labels.windowLegend}</span>
          {WINDOW_FILTERS.map((filter) => (
            <button
              key={filter.value}
              type="button"
              onClick={() => inbox.setWindowFilter(filter.value)}
              aria-pressed={inbox.windowFilter === filter.value}
              data-cv-tooltip={filter.label} aria-label={filter.label}
              className={[
                'cv-workspace-chip',
                filter.tone ? `cv-workspace-chip--${filter.tone}` : '',
                inbox.windowFilter === filter.value ? 'cv-workspace-chip--on' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {filter.label}
            </button>
          ))}
        </div>

        {/* Some quando há um canal só: filtro de opção única não filtra nada. */}
        {inbox.channelFilters.length > 0 ? (
          <div className="cv-workspace-chips">
            <span className="cv-workspace-chips__legend">{labels.channelLegend}</span>
            {inbox.channelFilters.map((filter) => (
              <button
                data-cv-tooltip={filter.label} aria-label={filter.label}
                key={filter.value}
                type="button"
                onClick={() => inbox.setChannelFilter(filter.value)}
                aria-pressed={inbox.channelFilter === filter.value}
                className={`cv-workspace-chip${inbox.channelFilter === filter.value ? ' cv-workspace-chip--on' : ''}`}
              >
                {filter.value === CHANNEL_FILTER_ALL ? null : <ChannelIcon channel={filter.value} />}
                {filter.label}
              </button>
            ))}
          </div>
        ) : null}

        {renderFilters?.(inbox)}

        <label className="cv-workspace-selectall">
          <input type="checkbox" checked={inbox.allOnPageSelected} onChange={inbox.toggleSelectAllOnPage} />
          {labels.selectAll}
        </label>
      </div>

      <div className="cv-workspace-rows">
        {inbox.pageConversations.map((conversation) =>
          renderRow ? (
            <div key={conversation.id}>{renderRow(conversation)}</div>
          ) : (
            <ConversationRow
              key={conversation.id}
              conversation={conversation}
              active={conversation.id === inbox.selectedId}
              selected={inbox.selectedIds.has(conversation.id)}
              now={inbox.now}
              busy={inbox.busy}
              onOpen={() => inbox.selectConversation(conversation.id)}
              onToggleSelected={() => inbox.toggleSelected(conversation.id)}
              onTakeover={() => void inbox.takeover(conversation.id)}
            />
          ),
        )}
        {!inbox.loading && inbox.filteredCount === 0 ? (
          <p className="cv-workspace-empty">{labels.emptyList}</p>
        ) : null}
      </div>

      <div className="cv-workspace-pager">
        <span>{labels.rangeOf(inbox.firstOnPage, inbox.lastOnPage, inbox.filteredCount)}</span>
        <div className="cv-workspace-pager__buttons">
          <button type="button" onClick={() => inbox.goToPage(1)} disabled={inbox.page === 1} aria-label={PAGINATION_LABELS.first} data-cv-tooltip={PAGINATION_LABELS.first}>
            «
          </button>
          <button
            type="button"
            onClick={() => inbox.goToPage(inbox.page - 1)}
            disabled={inbox.page === 1}
            aria-label={PAGINATION_LABELS.previous} data-cv-tooltip={PAGINATION_LABELS.previous}
          >
            ‹
          </button>
          <span>{labels.pageOf(inbox.page, inbox.pageCount)}</span>
          <button
            type="button"
            onClick={() => inbox.goToPage(inbox.page + 1)}
            disabled={inbox.page === inbox.pageCount}
            aria-label={PAGINATION_LABELS.next} data-cv-tooltip={PAGINATION_LABELS.next}
          >
            ›
          </button>
          <button
            type="button"
            onClick={() => inbox.goToPage(inbox.pageCount)}
            disabled={inbox.page === inbox.pageCount}
            aria-label={PAGINATION_LABELS.last} data-cv-tooltip={PAGINATION_LABELS.last}
          >
            »
          </button>
        </div>
      </div>
    </aside>
  )
}
