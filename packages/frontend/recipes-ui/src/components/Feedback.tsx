/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

export type FeedbackProps = { readonly feedback: { readonly kind: 'success' | 'error'; readonly message: string } | undefined }

/** Toda ação responde na tela: sucesso e falha anunciados, nunca em silêncio. */
export function Feedback({ feedback }: FeedbackProps) {
  return (
    <p className={`arc-status${feedback ? ` arc-status--${feedback.kind}` : ''}`} role="status" aria-live="polite">
      {feedback?.message ?? ''}
    </p>
  )
}
