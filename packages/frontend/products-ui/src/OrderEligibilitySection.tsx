import { ORDER_AUDIENCE, type OrderAudience } from './providers/types'
import {
  MAX_ORDER_AGE,
  QUICK_MINIMUM_AGE,
  type OrderEligibilityDraft,
  type OrderEligibilityLabels,
} from './lib/orderEligibility'

export type OrderEligibilitySectionProps = {
  readonly value: OrderEligibilityDraft
  readonly labels: OrderEligibilityLabels
  readonly error?: string
  readonly onChange: (value: OrderEligibilityDraft) => void
}

const INPUT_CLASS =
  'w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500'
const LABEL_CLASS = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'
const OPTION_BASE =
  'min-h-11 px-3 py-2 text-sm font-medium rounded-lg border transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500'
const OPTION_ON = 'bg-brand-600 border-brand-600 text-white'
const OPTION_OFF =
  'bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'

export function OrderEligibilitySection({ value, labels, error, onChange }: OrderEligibilitySectionProps) {
  const audienceOptions: readonly { readonly audience: OrderAudience; readonly label: string }[] = [
    { audience: ORDER_AUDIENCE.EVERYONE, label: labels.everyone },
    { audience: ORDER_AUDIENCE.STAYING_GUESTS, label: labels.stayingGuests },
  ]
  const isQuickAgeOn = value.minimumAge === String(QUICK_MINIMUM_AGE)

  function handleAgeChange(raw: string) {
    onChange({ ...value, minimumAge: raw.replace(/\D/g, '').slice(0, String(MAX_ORDER_AGE).length) })
  }

  function handleQuickAge() {
    onChange({ ...value, minimumAge: isQuickAgeOn ? '' : String(QUICK_MINIMUM_AGE) })
  }

  return (
    <fieldset className="space-y-4" data-testid="order-eligibility-section">
      <legend className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">{labels.section}</legend>

      <div>
        <label className={LABEL_CLASS} htmlFor="product-minimum-age">
          {labels.minimumAge}
        </label>
        <div className="flex gap-2">
          <input
            id="product-minimum-age"
            type="text"
            inputMode="numeric"
            value={value.minimumAge}
            onChange={(event) => handleAgeChange(event.target.value)}
            className={`flex-1 ${INPUT_CLASS} ${error ? 'border-red-300 bg-red-50' : ''}`}
            placeholder={labels.minimumAgePlaceholder}
            aria-invalid={error ? true : undefined}
          />
          <button
            type="button"
            onClick={handleQuickAge}
            aria-pressed={isQuickAgeOn}
            className={`${OPTION_BASE} ${isQuickAgeOn ? OPTION_ON : OPTION_OFF}`}
          >
            {labels.quickAgeChip}
          </button>
        </div>
        {error ? (
          <p className="mt-1 text-xs text-red-500">{error}</p>
        ) : (
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{labels.minimumAgeHint}</p>
        )}
      </div>

      <div role="radiogroup" aria-label={labels.audience} className="flex flex-wrap gap-2">
        {audienceOptions.map((option) => {
          const isSelected = value.audience === option.audience
          return (
            <button
              key={option.audience}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => onChange({ ...value, audience: option.audience })}
              className={`${OPTION_BASE} ${isSelected ? OPTION_ON : OPTION_OFF}`}
            >
              {option.label}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}
