import type { ParticipantConversationsLabels } from './participantLabels'

export type ParticipantLoadErrorProps = {
  readonly labels: ParticipantConversationsLabels
  readonly onRetry: () => void
}

export function ParticipantLoadError({ labels, onRetry }: ParticipantLoadErrorProps) {
  return (
    <div className="cv-p-error" role="alert">
      <p className="cv-p-error__message">{labels.loadError}</p>
      <button type="button" className="cv-p-button" onClick={onRetry}>
        {labels.retry}
      </button>
    </div>
  )
}

export function ParticipantLoading({ labels }: { readonly labels: ParticipantConversationsLabels }) {
  return (
    <div className="cv-p-loading">
      <span className="cv-p-skeleton" aria-hidden="true" />
      <span className="cv-p-skeleton" aria-hidden="true" />
      <span className="cv-p-sr-only">{labels.loading}</span>
    </div>
  )
}
