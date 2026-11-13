/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Agenda e disponibilidade escolhem recurso do mesmo jeito. A lista cresce com o cadastro, então
 * ela sempre vai com busca — é o caso que o `web.md` §11 tira do `<select>` nativo por definição.
 */

import { useMemo } from 'react'
import type { Resource, ResourceId } from '@adatechnology/scheduling-contracts'

import { SelectField, type SelectOption } from './SelectField'

export type ResourceSelectProps = {
  readonly label: string
  readonly emptyOptionLabel: string
  readonly resources: readonly Resource[]
  readonly value: ResourceId
  readonly onChange: (resourceId: ResourceId) => void
}

export function ResourceSelect({ label, emptyOptionLabel, resources, value, onChange }: ResourceSelectProps) {
  const options = useMemo<readonly SelectOption[]>(
    () => resources.map((resource) => ({ value: resource.id, label: resource.name })),
    [resources],
  )

  return (
    <SelectField
      label={label}
      emptyOptionLabel={emptyOptionLabel}
      options={options}
      value={value}
      onChange={onChange}
      searchable
      className="min-w-52"
    />
  )
}
