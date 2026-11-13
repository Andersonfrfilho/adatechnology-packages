/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { useId } from 'react'

import { EnvironmentCard } from './EnvironmentCard.component'
import { useInfraMessages } from '../providers'
import type { InfraProject } from '../types/infra.types'

type ProjectGroupProps = {
  readonly project: InfraProject
}

export function ProjectGroup({ project }: ProjectGroupProps) {
  const infraLocale = useInfraMessages()
  const headingId = useId()

  return (
    <section aria-labelledby={headingId} className="space-y-3">
      <h2 className="text-sm font-semibold text-gray-900 dark:text-white" id={headingId}>
        {project.projectName}
        <span className="ml-2 font-normal text-gray-600 tabular-nums dark:text-gray-300">
          {project.environments.length} {infraLocale.environments.environmentsCount}
        </span>
      </h2>
      <div className="grid gap-3 md:grid-cols-2">
        {project.environments.map((environment) => (
          <EnvironmentCard environment={environment} key={environment.environmentId} />
        ))}
      </div>
    </section>
  )
}
