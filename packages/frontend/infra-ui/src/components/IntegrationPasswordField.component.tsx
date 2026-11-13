/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { useId } from 'react'

import { useInfraMessages } from '../providers'
import { INTEGRATION_PASSWORD_FIELD_NAME } from '../constants/infraIntegration.constant'
import { INFRA_FIELD, INFRA_HINT, INFRA_LABEL } from '../constants/infraStyle.constant'

type IntegrationPasswordFieldProps = {
  readonly value: string
  readonly isReadOnly: boolean
  readonly hint?: string
  readonly onChange: (value: string) => void
}

/** Esta e a senha do proprio usuario: `current-password` deixa o gerenciador preenche-la, ao contrario do token. */
export function IntegrationPasswordField({ value, isReadOnly, hint, onChange }: IntegrationPasswordFieldProps) {
  const infraLocale = useInfraMessages()
  const fieldId = useId()
  const hintId = useId()

  return (
    <div>
      <label className={INFRA_LABEL} htmlFor={fieldId}>
        {infraLocale.integration.form.passwordLabel}
      </label>
      <input
        aria-describedby={hint ? hintId : undefined}
        autoComplete="current-password"
        className={`${INFRA_FIELD} min-h-10`}
        readOnly={isReadOnly}
        id={fieldId}
        name={INTEGRATION_PASSWORD_FIELD_NAME}
        onChange={(event) => onChange(event.target.value)}
        type="password"
        value={value}
      />
      {hint ? (
        <p className={INFRA_HINT} id={hintId}>
          {hint}
        </p>
      ) : null}
    </div>
  )
}
