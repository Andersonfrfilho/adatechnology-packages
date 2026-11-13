/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { TriangleAlert } from 'lucide-react'

import { CostTile } from './CostTile.component'
import { computeStagingShare } from '../utils/costChart.util'
import { formatCycleRange, formatPercent, formatPercentPoints, formatUsd } from '../utils/costFormat.util'
import { useInfraMessages } from '../providers'
import type { InfraCosts } from '../types/infra.types'
import { fillTemplate } from '../utils/zonedTime.util'

type CostSummaryProps = {
  readonly costs: InfraCosts
}

export function CostSummary({ costs }: CostSummaryProps) {
  const infraLocale = useInfraMessages()
  const locale = infraLocale.costs
  const stagingShare = computeStagingShare({ projects: costs.projects })
  const hasOfficialTotal = costs.officialTotal !== undefined

  return (
    <section className="space-y-3">
      <dl className="grid grid-cols-1 gap-3 tablet:grid-cols-2 md:grid-cols-4">
        <CostTile label={locale.total} value={formatUsd(costs.totalCost)} />
        <CostTile
          label={locale.projection}
          note={`${locale.projectionMethod}. ${locale.projectionExplanation}`}
          value={formatUsd(costs.projectedTotal)}
        />
        <CostTile
          isWarning={costs.isDivergent}
          label={locale.officialTotal}
          note={costs.isDivergent ? <DivergenceNote divergencePercent={costs.divergencePercent} /> : undefined}
          value={hasOfficialTotal ? formatUsd(costs.officialTotal ?? 0) : locale.officialTotalMissing}
        />
        <CostTile
          label={locale.period}
          value={formatCycleRange({ periodStart: costs.periodStart, periodEnd: costs.periodEnd })}
        />
      </dl>

      <p className="rounded-lg bg-brand-50 px-4 py-3 text-sm font-medium text-brand-900 dark:bg-brand-900 dark:text-brand-50">
        {stagingShare === undefined
          ? locale.stagingShareUnavailable
          : fillTemplate({ template: locale.stagingShare, values: { percent: formatPercent(stagingShare) } })}
      </p>
    </section>
  )
}

type DivergenceNoteProps = { readonly divergencePercent: number | undefined }

function DivergenceNote({ divergencePercent }: DivergenceNoteProps) {
  const infraLocale = useInfraMessages()
  const locale = infraLocale.costs
  const percent = divergencePercent === undefined ? '' : formatPercentPoints(Math.abs(divergencePercent))

  return (
    <span className="flex items-start gap-1.5 font-medium text-amber-900 dark:text-amber-100">
      <TriangleAlert aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
      {fillTemplate({ template: locale.divergenceWarning, values: { percent } })}
    </span>
  )
}
