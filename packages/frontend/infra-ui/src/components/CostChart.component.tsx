/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { CostBarRow } from './CostBarRow.component'
import { CostSwatch } from './CostSwatch.component'
import { buildChartSegments } from '../utils/costChart.util'
import { formatUsd } from '../utils/costFormat.util'
import { useInfraMessages } from '../providers'
import { COST_STAGING_BASE_FILL, COST_STAGING_STRIPE_FILL, INFRA_PANEL_CARD } from '../constants/infraStyle.constant'
import { COST_KIND, COST_STAGING_PATTERN_ID } from '../constants/infraUi.constant'
import type { InfraProjectCost } from '../types/infra.types'
import { fillTemplate } from '../utils/zonedTime.util'

type CostChartProps = {
  readonly projects: readonly InfraProjectCost[]
}

const STRIPE_SIZE = 7
const STRIPE_WIDTH = 3

export function CostChart({ projects }: CostChartProps) {
  const infraLocale = useInfraMessages()
  const segments = buildChartSegments({ projects })
  const largestTotal = segments[0]?.totalCost ?? 0
  const ariaSummary = segments
    .map((segment) =>
      fillTemplate({
        template: infraLocale.costs.chartAriaItem,
        values: {
          project: segment.projectName,
          total: formatUsd(segment.totalCost),
          staging: formatUsd(segment.stagingCost),
          production: formatUsd(segment.productionCost),
        },
      }),
    )
    .join('; ')
  const ariaLabel = fillTemplate({ template: infraLocale.costs.chartAriaLabel, values: { summary: ariaSummary } })

  return (
    <section aria-labelledby="infra-cost-chart-title" className={`${INFRA_PANEL_CARD} space-y-3 p-4`}>
      <svg aria-hidden="true" className="absolute size-0" focusable="false">
        <defs>
          <pattern
            height={STRIPE_SIZE}
            id={COST_STAGING_PATTERN_ID}
            patternTransform="rotate(45)"
            patternUnits="userSpaceOnUse"
            width={STRIPE_SIZE}
          >
            <rect className={COST_STAGING_BASE_FILL} height={STRIPE_SIZE} width={STRIPE_SIZE} />
            <rect className={COST_STAGING_STRIPE_FILL} height={STRIPE_SIZE} width={STRIPE_WIDTH} />
          </pattern>
        </defs>
      </svg>

      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white" id="infra-cost-chart-title">
          {infraLocale.costs.chartTitle}
        </h2>
        <div
          aria-label={infraLocale.costs.legend}
          className="flex flex-wrap gap-x-4 text-xs text-gray-700 dark:text-gray-300"
          role="group"
        >
          <span className="inline-flex items-center gap-1.5">
            <CostSwatch kind={COST_KIND.PRODUCTION} />
            {infraLocale.costs.kindProduction}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <CostSwatch kind={COST_KIND.STAGING} />
            {infraLocale.costs.kindStaging}
          </span>
        </div>
      </header>

      <ul aria-label={ariaLabel} className="space-y-4" role="img">
        {segments.map((segment) => (
          <CostBarRow key={segment.projectId} segment={segment} />
        ))}
      </ul>

      <div aria-hidden="true" className="flex items-center gap-3 text-xs text-gray-600 tabular-nums dark:text-gray-400">
        <div className="flex min-w-0 flex-1 justify-between border-t border-gray-300 pt-1 dark:border-gray-600">
          <span>{formatUsd(0)}</span>
          <span>{formatUsd(largestTotal)}</span>
        </div>
        <span className="w-28 shrink-0" />
      </div>
      <p className="text-xs text-gray-600 dark:text-gray-400">{infraLocale.costs.chartTableHint}</p>
    </section>
  )
}
