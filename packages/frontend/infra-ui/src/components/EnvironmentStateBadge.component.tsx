/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { CircleAlert, CircleCheck, CircleMinus, LoaderCircle, type LucideIcon } from 'lucide-react'

import { INFRA_ENVIRONMENT_POWER_STATE, type InfraEnvironmentPowerState } from '../constants/infra.constant'
import { useInfraMessages } from '../providers'

type EnvironmentStateBadgeProps = {
  readonly state: InfraEnvironmentPowerState
}

type StateAppearance = { readonly Icon: LucideIcon; readonly tone: string; readonly iconClass: string }

const BADGE_BASE = 'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold'

const STATE_APPEARANCE: Readonly<Record<InfraEnvironmentPowerState, StateAppearance>> = {
  [INFRA_ENVIRONMENT_POWER_STATE.RUNNING]: {
    Icon: CircleCheck,
    tone: 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-100',
    iconClass: '',
  },
  [INFRA_ENVIRONMENT_POWER_STATE.STOPPED]: {
    Icon: CircleMinus,
    tone: 'border-gray-300 bg-gray-100 text-gray-800 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100',
    iconClass: '',
  },
  [INFRA_ENVIRONMENT_POWER_STATE.PARTIAL]: {
    Icon: CircleAlert,
    tone: 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100',
    iconClass: '',
  },
  [INFRA_ENVIRONMENT_POWER_STATE.TRANSITIONING]: {
    Icon: LoaderCircle,
    tone: 'border-sky-300 bg-sky-50 text-sky-900 dark:border-sky-700 dark:bg-sky-950 dark:text-sky-100',
    iconClass: 'motion-safe:animate-spin',
  },
}

/** O estado nunca depende so da cor: sempre icone e texto. */
export function EnvironmentStateBadge({ state }: EnvironmentStateBadgeProps) {
  const infraLocale = useInfraMessages()
  const { Icon, tone, iconClass } = STATE_APPEARANCE[state]

  return (
    <span className={`${BADGE_BASE} ${tone}`}>
      <Icon aria-hidden="true" className={`size-3.5 ${iconClass}`} />
      {infraLocale.state[state]}
    </span>
  )
}
