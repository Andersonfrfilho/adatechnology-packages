/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { CostChart } from '../components/CostChart.component'
import { CostFooter } from '../components/CostFooter.component'
import { CostNotices } from '../components/CostNotices.component'
import { CostSummary } from '../components/CostSummary.component'
import { CostTable } from '../components/CostTable.component'
import { InfraPageHeader } from '../components/InfraPageHeader.component'
import { InfraQueryError } from '../components/InfraQueryError.component'
import { useInfraCosts } from '../hooks/infra.hook'
import { useInfraMessages } from '../providers'

export function CostsArea() {
  const locale = useInfraMessages().costs
  const { data, isPending, isError, error, refetch } = useInfraCosts()

  return (
    <section className="h-full min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
      <InfraPageHeader subtitle={locale.subtitle} title={locale.title} />

      {isPending ? (
        <p className="text-sm text-gray-500 dark:text-gray-400" role="status">
          {locale.loading}
        </p>
      ) : null}

      {isError ? (
        <InfraQueryError
          error={error}
          failureMessage={locale.loadFailed}
          onRetry={() => void refetch()}
          retryLabel={locale.retry}
        />
      ) : null}

      {data ? (
        <>
          <CostNotices costs={data} />
          {data.projects.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">{locale.empty}</p>
          ) : (
            <div className="space-y-6">
              <CostSummary costs={data} />
              <CostChart projects={data.projects} />
              <CostTable costs={data} />
            </div>
          )}
          <CostFooter pricingCheckedAt={data.pricingCheckedAt} pricingSource={data.pricingSource} />
        </>
      ) : null}
    </section>
  )
}
