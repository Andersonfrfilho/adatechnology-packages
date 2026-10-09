export interface MessageTextCopiedBadgeProps {
  label?: string
}

export function MessageTextCopiedBadge({ label = 'Copied' }: MessageTextCopiedBadgeProps) {
  return <span className="cv-message-text__copied">{label}</span>
}
