import type { AttributeEntry } from './lib/productFields'

export type AttributesEditorProps = {
  readonly entries: readonly AttributeEntry[]
  readonly onChange: (entries: readonly AttributeEntry[]) => void
}

const INPUT_CLASS = 'w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500'
const LABEL_CLASS = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'

export function AttributesEditor({ entries, onChange }: AttributesEditorProps) {
  function handleEntryChange(index: number, patch: Partial<AttributeEntry>) {
    onChange(entries.map((entry, position) => (position === index ? { ...entry, ...patch } : entry)))
  }

  return (
    <fieldset className="space-y-2">
      <legend className={LABEL_CLASS}>Atributos</legend>
      {entries.map((entry, index) => (
        <div key={index} className="flex gap-2">
          <input
            type="text"
            value={entry.key}
            onChange={(e) => handleEntryChange(index, { key: e.target.value })}
            className={INPUT_CLASS}
            placeholder="Chave"
            aria-label={`Chave do atributo ${index + 1}`}
          />
          <input
            type="text"
            value={entry.value}
            onChange={(e) => handleEntryChange(index, { value: e.target.value })}
            className={INPUT_CLASS}
            placeholder="Valor"
            aria-label={`Valor do atributo ${index + 1}`}
          />
          <button
            type="button"
            onClick={() => onChange(entries.filter((_, position) => position !== index))}
            className="px-3 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800"
            aria-label={`Remover atributo ${index + 1}`}
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...entries, { key: '', value: '' }])}
        className="text-sm font-medium text-brand-600 hover:text-brand-700"
      >
        + Adicionar atributo
      </button>
    </fieldset>
  )
}
