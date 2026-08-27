/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Agenda e disponibilidade escolhem recurso do mesmo jeito. A opção vazia era um travessão, que
 * não diz se filtra tudo ou nada — na agenda ela é "Todos", e na disponibilidade a área só abre
 * depois da escolha.
 */

import type { Resource, ResourceId } from '@adatechnology/scheduling-contracts'

import { FIELD_CONTROL, FIELD_LABEL } from './ui.constant'

export type ResourceSelectProps = {
  readonly label: string
  readonly emptyOptionLabel: string
  readonly resources: readonly Resource[]
  readonly value: ResourceId
  readonly onChange: (resourceId: ResourceId) => void
}

export function ResourceSelect({ label, emptyOptionLabel, resources, value, onChange }: ResourceSelectProps) {
  return (
    <label className="flex flex-col gap-1">
      <span className={FIELD_LABEL}>{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`${FIELD_CONTROL} min-w-44`}
      >
        <option value="">{emptyOptionLabel}</option>
        {resources.map((resource) => (
          <option key={resource.id} value={resource.id}>
            {resource.name}
          </option>
        ))}
      </select>
    </label>
  )
}
