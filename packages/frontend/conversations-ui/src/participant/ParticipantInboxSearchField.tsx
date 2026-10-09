import { useId } from 'react'

import type { ParticipantConversationsLabels } from './participantLabels'

export type ParticipantInboxSearch = {
  readonly value: string
  readonly onChange: (value: string) => void
  readonly isVisible: boolean
}

export type ParticipantInboxSearchFieldProps = {
  readonly search: ParticipantInboxSearch
  readonly labels: ParticipantConversationsLabels
}

export function ParticipantInboxSearchField({ search, labels }: ParticipantInboxSearchFieldProps) {
  const inputId = useId()
  return (
    <div className="cv-p-search">
      <label className="cv-p-sr-only" htmlFor={inputId}>
        {labels.searchLabel}
      </label>
      <input
        id={inputId}
        type="search"
        className="cv-p-search__input"
        value={search.value}
        placeholder={labels.searchPlaceholder}
        autoComplete="off"
        onChange={(event) => search.onChange(event.target.value)}
      />
    </div>
  )
}
