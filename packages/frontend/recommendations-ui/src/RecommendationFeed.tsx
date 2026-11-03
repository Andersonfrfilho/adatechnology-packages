/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * O feed do usuário final. Duas garantias que não dependem do host lembrar:
 *
 * - todo item patrocinado sai com o rótulo de patrocinado (CDC art. 36: publicidade identificável);
 * - o link abre com `rel="noopener noreferrer sponsored"` — o anunciante não recebe a página de
 *   origem, e buscador não conta o anúncio como indicação orgânica.
 */

import { useEffect, useRef, type ReactNode } from 'react'

import { useRecommendationLabels } from './providers/RecommendationsProvider'
import type { FeedEntry, FeedQuery } from './providers/types'
import { useRecommendationFeed } from './useRecommendationFeed'

export type RecommendationCardProps = {
  readonly entry: FeedEntry
  readonly onVisible: (entry: FeedEntry) => void
  readonly onOpen: (entry: FeedEntry) => void
}

function useVisibleOnce(onVisible: () => void) {
  const ref = useRef<HTMLElement | null>(null)
  const callback = useRef(onVisible)
  callback.current = onVisible

  useEffect(() => {
    const node = ref.current
    if (!node) return
    if (typeof IntersectionObserver === 'undefined') {
      callback.current()
      return
    }
    // Metade do card na tela conta como visto — o padrão de mercado para impressão de display.
    const observer = new IntersectionObserver(
      (observed) => {
        if (observed.some((entry) => entry.isIntersecting)) {
          callback.current()
          observer.disconnect()
        }
      },
      { threshold: 0.5 },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  return ref
}

export function RecommendationCard({ entry, onVisible, onOpen }: RecommendationCardProps) {
  const labels = useRecommendationLabels()
  const ref = useVisibleOnce(() => onVisible(entry))
  const place = [entry.city, entry.state].filter(Boolean).join(' - ')

  return (
    <article
      ref={ref as never}
      className="flex min-w-[220px] max-w-[280px] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800"
    >
      {entry.imageUrl ? <img src={entry.imageUrl} alt="" loading="lazy" className="h-32 w-full object-cover" /> : null}
      <div className="flex flex-1 flex-col gap-1 p-3">
        <span
          className={
            entry.sponsored
              ? 'self-start rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-800'
              : 'self-start rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300'
          }
        >
          {entry.sponsored ? labels.sponsored : labels.curated}
        </span>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{entry.title}</h3>
        {entry.summary ? (
          <p className="line-clamp-3 text-xs text-gray-600 dark:text-gray-300">{entry.summary}</p>
        ) : null}
        {place ? <p className="text-xs text-gray-500 dark:text-gray-400">{place}</p> : null}
        {entry.linkUrl ? (
          <a
            href={entry.linkUrl}
            target="_blank"
            rel={entry.sponsored ? 'noopener noreferrer sponsored' : 'noopener noreferrer'}
            onClick={() => onOpen(entry)}
            className="mt-auto pt-2 text-xs font-semibold text-gray-900 underline underline-offset-2 dark:text-gray-100"
          >
            {labels.open}
          </a>
        ) : null}
      </div>
    </article>
  )
}

export type RecommendationFeedProps = FeedQuery & {
  /** Título acima da faixa. Sem ele, só os cards. */
  readonly heading?: ReactNode
  /** Esconde a seção inteira quando não há nada para mostrar. Padrão: true. */
  readonly hideWhenEmpty?: boolean
  readonly enabled?: boolean
  /** Card próprio do host, no lugar do padrão. Receba e repasse `onVisible`/`onOpen`. */
  readonly renderCard?: (props: RecommendationCardProps) => ReactNode
  readonly className?: string
}

export function RecommendationFeed({
  heading,
  hideWhenEmpty = true,
  renderCard,
  className,
  ...query
}: RecommendationFeedProps) {
  const labels = useRecommendationLabels()
  const { entries, loading, error, reload, trackImpression, trackClick } = useRecommendationFeed(query)

  if (loading) return null
  if (error) {
    // Recomendação é complemento da tela: com erro, some — exceto quando o host não quer sumir.
    if (hideWhenEmpty) return null
    return (
      <section className={className}>
        <p className="text-sm text-gray-600">{labels.loadError}</p>
        <button type="button" onClick={reload} className="text-sm font-semibold underline">
          {labels.retry}
        </button>
      </section>
    )
  }
  if (entries.length === 0) {
    if (hideWhenEmpty) return null
    return (
      <section className={className}>
        {heading}
        <p className="text-sm text-gray-600">{labels.empty}</p>
      </section>
    )
  }

  return (
    <section className={className}>
      {heading}
      <div className="flex gap-3 overflow-x-auto pb-2">
        {entries.map((entry) => {
          const props = { entry, onVisible: trackImpression, onOpen: trackClick }
          return renderCard ? (
            <div key={entry.itemId}>{renderCard(props)}</div>
          ) : (
            <RecommendationCard key={entry.itemId} {...props} />
          )
        })}
      </div>
    </section>
  )
}
