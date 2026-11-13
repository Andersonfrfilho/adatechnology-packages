/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { CostSwatch } from './CostSwatch.component'
import type { CostChartSegment } from '../utils/costChart.util'
import { formatUsd } from '../utils/costFormat.util'
import { useInfraMessages } from '../providers'
import { COST_PRODUCTION_FILL, COST_TRACK_FILL } from '../constants/infraStyle.constant'
import { COST_KIND, COST_STAGING_PATTERN_ID } from '../constants/infraUi.constant'

type CostBarRowProps = {
  readonly segment: CostChartSegment
}

const BAR_HEIGHT = 20
const FULL_WIDTH_PERCENT = 100

function toPercent(ratio: number): string {
  return `${(ratio * FULL_WIDTH_PERCENT).toFixed(3)}%`
}

/** Larguras em porcentagem como atributo SVG (nao e estilo inline) e sem `viewBox` esticado: o padrao listrado nao distorce. */
export function CostBarRow({ segment }: CostBarRowProps) {
  const infraLocale = useInfraMessages()
  const productionRatio = segment.lengthRatio * segment.productionRatio
  const stagingRatio = segment.lengthRatio * segment.stagingRatio

  return (
    <li className="space-y-1">
      <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">{segment.projectName}</p>
      <div className="flex items-center gap-3">
        <svg className="block min-w-0 flex-1 rounded-sm" height={BAR_HEIGHT} width="100%">
          <rect className={COST_TRACK_FILL} height={BAR_HEIGHT} width="100%" />
          <rect className={COST_PRODUCTION_FILL} height={BAR_HEIGHT} width={toPercent(productionRatio)} x="0%" />
          <rect
            fill={`url(#${COST_STAGING_PATTERN_ID})`}
            height={BAR_HEIGHT}
            width={toPercent(stagingRatio)}
            x={toPercent(productionRatio)}
          />
        </svg>
        <span className="w-28 shrink-0 text-right text-sm font-semibold text-gray-900 tabular-nums dark:text-white">
          {formatUsd(segment.totalCost)}
        </span>
      </div>
      <p className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-gray-700 tabular-nums dark:text-gray-300">
        <span className="inline-flex items-center gap-1.5">
          <CostSwatch kind={COST_KIND.PRODUCTION} />
          {infraLocale.costs.kindProduction} {formatUsd(segment.productionCost)}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <CostSwatch kind={COST_KIND.STAGING} />
          {infraLocale.costs.kindStaging} {formatUsd(segment.stagingCost)}
        </span>
      </p>
    </li>
  )
}
