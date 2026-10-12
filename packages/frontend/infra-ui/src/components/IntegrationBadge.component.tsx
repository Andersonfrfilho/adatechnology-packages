/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { CircleAlert, CircleCheck, Info, TriangleAlert, type LucideIcon } from 'lucide-react'

import { INFRA_INTEGRATION_TONE, type InfraIntegrationTone } from '../constants/infraIntegration.constant'

type IntegrationBadgeProps = {
  readonly tone: InfraIntegrationTone
  readonly label: string
}

type BadgeAppearance = { readonly Icon: LucideIcon; readonly classes: string }

const BADGE_BASE = 'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold'

const BADGE_APPEARANCE: Readonly<Record<InfraIntegrationTone, BadgeAppearance>> = {
  [INFRA_INTEGRATION_TONE.OK]: {
    Icon: CircleCheck,
    classes:
      'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-100',
  },
  [INFRA_INTEGRATION_TONE.NEUTRAL]: {
    Icon: Info,
    classes: 'border-gray-300 bg-gray-100 text-gray-800 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100',
  },
  [INFRA_INTEGRATION_TONE.WARNING]: {
    Icon: TriangleAlert,
    classes: 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100',
  },
  [INFRA_INTEGRATION_TONE.ERROR]: {
    Icon: CircleAlert,
    classes: 'border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200',
  },
}

/** O estado nunca depende so da cor: sempre icone e texto. */
export function IntegrationBadge({ tone, label }: IntegrationBadgeProps) {
  const { Icon, classes } = BADGE_APPEARANCE[tone]

  return (
    <span className={`${BADGE_BASE} ${classes}`}>
      <Icon aria-hidden="true" className="size-3.5 shrink-0" />
      {label}
    </span>
  )
}
