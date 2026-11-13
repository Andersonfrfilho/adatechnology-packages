export type MessageTextAppearance = 'tailwind' | 'stylesheet'

export interface MessageTextCopiedBadgeProps {
  label?: string
  /** 'tailwind' (default) keeps the 0.4.2 utility classes; 'stylesheet' uses the .cv-* rules from styles.css. */
  appearance?: MessageTextAppearance
}

const TAILWIND_CLASS =
  'absolute top-0 right-0 -translate-y-full bg-[#3b4a54] text-white text-[11px] px-1.5 py-0.5 rounded shadow-lg'

export function MessageTextCopiedBadge({ label = 'Copiado!', appearance = 'tailwind' }: MessageTextCopiedBadgeProps) {
  const className = appearance === 'stylesheet' ? 'cv-message-text__copied' : TAILWIND_CLASS
  return <span className={className}>{label}</span>
}
