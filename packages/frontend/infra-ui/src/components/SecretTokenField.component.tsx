/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { useId, useState } from 'react'

import clsx from 'clsx'
import { Eye, EyeOff } from 'lucide-react'

import { useInfraMessages } from '../providers'
import { INTEGRATION_TOKEN_FIELD_NAME, INTEGRATION_TOKEN_MASK_CLASS } from '../constants/infraIntegration.constant'
import { INFRA_BUTTON_SECONDARY, INFRA_FIELD, INFRA_HINT, INFRA_LABEL } from '../constants/infraStyle.constant'

type SecretTokenFieldProps = {
  readonly value: string
  readonly isVisible: boolean
  readonly isReadOnly: boolean
  readonly issueMessage: string | undefined
  readonly onChange: (value: string) => void
  readonly onToggleVisibility: () => void
}

/**
 * Campo de texto mascarado por CSS, e nao `type="password"`: assim gerenciadores de senha e
 * corretores nao o tratam como credencial do usuario nem o guardam (RF13).
 */
export function SecretTokenField({
  value,
  isVisible,
  isReadOnly,
  issueMessage,
  onChange,
  onToggleVisibility,
}: SecretTokenFieldProps) {
  const infraLocale = useInfraMessages()
  const locale = infraLocale.integration.form
  const fieldId = useId()
  const hintId = useId()
  const issueId = useId()
  const [isTouched, setIsTouched] = useState(false)
  const shownIssue = isTouched ? issueMessage : undefined

  return (
    <div>
      <label className={INFRA_LABEL} htmlFor={fieldId}>
        {locale.tokenLabel}
      </label>
      <div className="flex items-stretch gap-2">
        <input
          aria-describedby={shownIssue ? `${hintId} ${issueId}` : hintId}
          aria-invalid={shownIssue ? true : undefined}
          autoCapitalize="off"
          autoComplete="off"
          autoCorrect="off"
          className={clsx(INFRA_FIELD, 'min-h-10 min-w-0 flex-1 font-mono', !isVisible && INTEGRATION_TOKEN_MASK_CLASS)}
          data-1p-ignore
          data-bwignore
          data-form-type="other"
          data-lpignore="true"
          readOnly={isReadOnly}
          id={fieldId}
          inputMode="text"
          name={INTEGRATION_TOKEN_FIELD_NAME}
          onBlur={() => setIsTouched(true)}
          onChange={(event) => onChange(event.target.value)}
          spellCheck={false}
          type="text"
          value={value}
        />
        <button
          aria-label={isVisible ? locale.hideToken : locale.showToken}
          aria-pressed={isVisible}
          className={`${INFRA_BUTTON_SECONDARY} min-w-10 px-2`}
          onClick={onToggleVisibility}
          type="button"
        >
          {isVisible ? <EyeOff aria-hidden="true" className="size-4" /> : <Eye aria-hidden="true" className="size-4" />}
        </button>
      </div>
      <p className={INFRA_HINT} id={hintId}>
        {locale.tokenHint}
      </p>
      {shownIssue ? (
        <p className="mt-1 text-xs font-medium text-red-700 dark:text-red-300" id={issueId}>
          {shownIssue}
        </p>
      ) : null}
    </div>
  )
}
