import { ArrowLeft } from 'lucide-react'

export type ParticipantBackButtonProps = {
  readonly label: string
  readonly onBack: () => void
}

export function ParticipantBackButton({ label, onBack }: ParticipantBackButtonProps) {
  return (
    <button type="button" className="cv-p-thread__back" aria-label={label} onClick={onBack}>
      <ArrowLeft size={24} aria-hidden="true" focusable="false" />
    </button>
  )
}
