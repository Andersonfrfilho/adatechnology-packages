/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { formatCheckedDate, resolveSafeUrl } from '../utils/costFormat.util'
import { useInfraMessages } from '../providers'
import { INFRA_FOCUS_RING } from '../constants/infraStyle.constant'

type CostFooterProps = {
  readonly pricingCheckedAt: string
  readonly pricingSource: string
}

export function CostFooter({ pricingCheckedAt, pricingSource }: CostFooterProps) {
  const infraLocale = useInfraMessages()
  const sourceUrl = resolveSafeUrl(pricingSource)

  return (
    <footer className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600 dark:text-gray-400">
      <p>
        {infraLocale.costs.pricingCheckedAt}{' '}
        <time dateTime={pricingCheckedAt}>{formatCheckedDate(pricingCheckedAt)}</time>
      </p>
      <p>
        {infraLocale.costs.pricingSource}:{' '}
        {sourceUrl ? (
          <a
            className={`rounded underline ${INFRA_FOCUS_RING}`}
            href={sourceUrl}
            rel="noopener noreferrer"
            target="_blank"
          >
            {pricingSource}
          </a>
        ) : (
          pricingSource
        )}
      </p>
    </footer>
  )
}
