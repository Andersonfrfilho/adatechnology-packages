/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

export type FilterChipsProps<TValue extends string> = {
  readonly label: string
  readonly options: readonly { readonly value: TValue; readonly label: string }[]
  readonly selected: readonly TValue[]
  readonly onChange: (selected: TValue[]) => void
}

/** Filtro de seleção múltipla em botões alternáveis (sem `<select>` nativo). */
export function FilterChips<TValue extends string>({ label, options, selected, onChange }: FilterChipsProps<TValue>) {
  function toggle(value: TValue): void {
    onChange(selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value])
  }
  return (
    <div className="acp-filter" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={`acp-filter-chip${selected.includes(option.value) ? ' acp-filter-chip--on' : ''}`}
          aria-pressed={selected.includes(option.value)}
          onClick={() => toggle(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
