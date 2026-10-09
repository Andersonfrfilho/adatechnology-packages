import type { ParticipantConversationSummary, ParticipantSubjectRef } from '@adatechnology/conversation-contracts'

import type {
  ParticipantInboxFilter,
  ParticipantInboxSection,
  ParticipantInboxView,
  ParticipantSubjectGroup,
  ParticipantSubjectIconRenderer,
} from './participant.types'
import { type ParticipantConversationsLabels } from './participantLabels'
import { resolveLoadView, type ParticipantLoadStatus } from './participantLoadView'
import { ParticipantInboxRow } from './ParticipantInboxRow'
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
  /** Absent, or returning null/undefined, = the subject group icon. */
  readonly renderSubjectIcon?: ParticipantSubjectIconRenderer
}

const ALL_FILTER = 'all'

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
    <ParticipantInboxRow
      key={`${conversation.subjectType}:${conversation.subjectId}`}
      conversation={conversation}
      group={props.subjectGroups.find((group) => group.subjectType === conversation.subjectType)}
      labels={props.labels}
      locale={props.locale}
      onSelect={props.onSelect}
      renderSubjectIcon={props.renderSubjectIcon}
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
