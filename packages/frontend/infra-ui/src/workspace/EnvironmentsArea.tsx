/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { AccessBanner } from '../components/AccessBanner.component'
import { INFRA_ACCESS_STATUS, type InfraAccessStatus } from '../constants/infra.constant'
import { InfraPageHeader } from '../components/InfraPageHeader.component'
import { InfraQueryError } from '../components/InfraQueryError.component'
import { ProjectGroup } from '../components/ProjectGroup.component'
import { useInfraEnvironments } from '../hooks/infra.hook'
import { useInfraMessages } from '../providers'

export function EnvironmentsArea() {
  const locale = useInfraMessages().environments
  const { data, isPending, isError, error, refetch } = useInfraEnvironments()

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
          <AccessBanner access={data.access} />
          {/* Sem acesso ao provedor a lista vem vazia por falta de leitura, não por falta de ambientes. */}
          {isInventoryUnreadable(data.access) ? null : data.projects.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">{locale.empty}</p>
          ) : (
            <div className="space-y-6">
              {data.projects.map((project) => (
                <ProjectGroup key={project.projectId} project={project} />
              ))}
            </div>
          )}
        </>
      ) : null}
    </section>
  )
}

function isInventoryUnreadable(access: InfraAccessStatus): boolean {
  return access === INFRA_ACCESS_STATUS.TOKEN_INVALID || access === INFRA_ACCESS_STATUS.UNAVAILABLE
}
