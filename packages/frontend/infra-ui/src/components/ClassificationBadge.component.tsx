/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { Lock, SlidersHorizontal } from 'lucide-react'

import { INFRA_ENVIRONMENT_CLASSIFICATION, type InfraEnvironmentClassification } from '../constants/infra.constant'
import { useInfraMessages } from '../providers'

type ClassificationBadgeProps = {
  readonly classification: InfraEnvironmentClassification
}

const BADGE_BASE = 'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold'

export function ClassificationBadge({ classification }: ClassificationBadgeProps) {
  const infraLocale = useInfraMessages()
  const label = infraLocale.classification[classification]

  if (classification === INFRA_ENVIRONMENT_CLASSIFICATION.PROTECTED) {
    return (
      <span
        className={`${BADGE_BASE} border-brand-200 bg-brand-50 text-brand-800 dark:border-brand-700 dark:bg-brand-900 dark:text-brand-200`}
      >
        <Lock aria-hidden="true" className="size-3.5" />
        {label}
      </span>
    )
  }

  return (
    <span
      className={`${BADGE_BASE} border-gray-300 bg-white text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100`}
    >
      <SlidersHorizontal aria-hidden="true" className="size-3.5" />
      {label}
    </span>
  )
}
