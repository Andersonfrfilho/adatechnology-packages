import type { ParticipantConversationSummary, ParticipantSubjectRef } from '@adatechnology/conversation-contracts'

import { formatTimestamp, isSameDay } from '../lib/format'
import type {
  ParticipantInboxFilter,
  ParticipantInboxSection,
  ParticipantInboxView,
  ParticipantSubjectGroup,
} from './participant.types'
import { formatParticipantLabel, type ParticipantConversationsLabels } from './participantLabels'
import { resolveLoadView, type ParticipantLoadStatus } from './participantLoadView'
import { ParticipantInboxSearchField, type ParticipantInboxSearch } from './ParticipantInboxSearchField'
import { ParticipantLoadError, ParticipantLoading } from './ParticipantLoadState'

export type ParticipantInboxProps = {
  readonly view: ParticipantInboxView
  readonly subjectGroups: readonly ParticipantSubjectGroup[]
  /** subjectType of the active filter, or 'all'. */
  readonly filter: string
  readonly onFilterChange: (filter: string) => void
  readonly onSelect: (subject: ParticipantSubjectRef) => void
  readonly labels: ParticipantConversationsLabels
  readonly status: ParticipantLoadStatus
  readonly refresh: () => void
  readonly hasMore: boolean
  readonly loadMore: () => void
  readonly locale?: string
  /** Absent = no search field. The host narrows the view with the query; the field only edits it. */
  readonly search?: ParticipantInboxSearch
}

const ALL_FILTER = 'all'

function formatRowTime(iso: string, locale: string | undefined): string {
  const date = new Date(iso)
  if (isSameDay(date, new Date())) return formatTimestamp(iso)
  return date.toLocaleDateString(locale, { day: '2-digit', month: '2-digit' })
}

function resolveNoResultsLabel({ view, hasMore, labels }: ParticipantInboxProps): string {
  if (view.hasMatchesOutsideFilter) return labels.noResultsInFilter
  return hasMore ? labels.noResultsLoadedOnly : labels.noResults
}

function sectionTitle(section: ParticipantInboxSection, props: ParticipantInboxProps): string {
  if (section.key === 'awaiting') return props.labels.sectionAwaiting
  if (section.key === 'closed') return props.labels.sectionClosed
  if (section.key === 'other') return props.labels.sectionOther
  return props.subjectGroups.find((group) => group.subjectType === section.key)?.label ?? section.key
}

type FiltersProps = {
  readonly filters: readonly ParticipantInboxFilter[]
  readonly active: string
  readonly labels: ParticipantConversationsLabels
  readonly onChange: (filter: string) => void
}

function Filters({ filters, active, labels, onChange }: FiltersProps) {
  return (
    <div className="cv-p-filters" role="group" aria-label={labels.filtersGroup}>
      {filters.map((filter) => (
        <button
          key={filter.subjectType}
          type="button"
          className="cv-p-chip"
          aria-pressed={filter.subjectType === active}
          onClick={() => onChange(filter.subjectType)}
        >
          {filter.subjectType === ALL_FILTER ? labels.filterAll : filter.label}
          {filter.unreadCount > 0 ? <b className="cv-p-chip__count">{filter.unreadCount}</b> : null}
        </button>
      ))}
    </div>
  )
}

type RowProps = {
  readonly conversation: ParticipantConversationSummary
  readonly group: ParticipantSubjectGroup | undefined
  readonly labels: ParticipantConversationsLabels
  readonly locale?: string
  readonly onSelect: (subject: ParticipantSubjectRef) => void
}

function Row({ conversation, group, labels, locale, onSelect }: RowProps) {
  const kind = group?.label ?? conversation.subjectType
  const className = conversation.awaitingParticipant ? 'cv-p-row cv-p-row--awaiting' : 'cv-p-row'
  const { subjectType, subjectId } = conversation

  return (
    <button type="button" className={className} onClick={() => onSelect({ subjectType, subjectId })}>
      <span className="cv-p-row__icon" aria-hidden="true">
        {group?.icon ?? kind.slice(0, 2)}
      </span>
      <span className="cv-p-row__body">
        <span className="cv-p-row__kind">{kind}</span>
        <span className="cv-p-row__title">{conversation.subjectLabel}</span>
        {conversation.protocol ? (
          <span className="cv-p-protocol">
            <span className="cv-p-sr-only">{labels.protocolPrefix} </span>
            {conversation.protocol}
          </span>
        ) : null}
        {conversation.lastMessagePreview ? (
          <span className="cv-p-row__preview">{conversation.lastMessagePreview}</span>
        ) : null}
      </span>
      <span className="cv-p-row__meta">
        {conversation.lastMessageAt ? <span>{formatRowTime(conversation.lastMessageAt, locale)}</span> : null}
        {conversation.unreadCount > 0 ? (
          <span className="cv-p-row__unread">
            <span aria-hidden="true">{conversation.unreadCount}</span>
            <span className="cv-p-sr-only">{formatParticipantLabel(labels.unreadCount, conversation.unreadCount)}</span>
          </span>
        ) : null}
      </span>
    </button>
  )
}

function SectionHeading({ title, count }: { readonly title: string; readonly count: number }) {
  return (
    <>
      <span className="cv-p-section__title">{title}</span>
      <span className="cv-p-section__count">{count}</span>
    </>
  )
}

function Section({
  section,
  props,
}: {
  readonly section: ParticipantInboxSection
  readonly props: ParticipantInboxProps
}) {
  const rows = section.conversations.map((conversation) => (
    <Row
      key={`${conversation.subjectType}:${conversation.subjectId}`}
      conversation={conversation}
      group={props.subjectGroups.find((group) => group.subjectType === conversation.subjectType)}
      labels={props.labels}
      locale={props.locale}
      onSelect={props.onSelect}
    />
  ))
  const heading = <SectionHeading title={sectionTitle(section, props)} count={section.conversations.length} />

  if (section.key === 'closed') {
    return (
      <details className="cv-p-section cv-p-section--closed">
        <summary className="cv-p-section__heading">{heading}</summary>
        {rows}
      </details>
    )
  }
  const modifier = section.key === 'awaiting' ? ' cv-p-section--awaiting' : ''
  return (
    <section className={`cv-p-section${modifier}`}>
      <h3 className="cv-p-section__heading">{heading}</h3>
      {rows}
    </section>
  )
}

export function ParticipantInbox(props: ParticipantInboxProps) {
  const { view, labels, filter, onFilterChange } = props
  const isSearching = (props.search?.value.trim() ?? '') !== ''
  const loadView = resolveLoadView({ status: props.status, hasItems: view.sections.length > 0 || isSearching })
  const hasNoResults = isSearching && view.sections.length === 0 && props.status === 'ready'
  const noResultsLabel = resolveNoResultsLabel(props)

  return (
    <div className="cv-p cv-p-inbox" aria-busy={loadView.isLoading}>
      <h2 className="cv-p-inbox__title">{labels.inboxTitle}</h2>
      {view.showFilters ? (
        <Filters filters={view.filters} active={filter} labels={labels} onChange={onFilterChange} />
      ) : null}
      {props.search?.isVisible ? <ParticipantInboxSearchField search={props.search} labels={labels} /> : null}
      {loadView.isLoading ? <ParticipantLoading labels={labels} /> : null}
      {loadView.hasError ? <ParticipantLoadError labels={labels} onRetry={props.refresh} /> : null}
      {loadView.isEmpty ? <p className="cv-p-empty">{labels.emptyInbox}</p> : null}
      {hasNoResults ? <p className="cv-p-empty">{noResultsLabel}</p> : null}
      {view.sections.map((section) => (
        <Section key={section.key} section={section} props={props} />
      ))}
      {props.hasMore ? (
        <button type="button" className="cv-p-button cv-p-inbox__more" onClick={props.loadMore}>
          {labels.loadMore}
        </button>
      ) : null}
    </div>
  )
}
