/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { RefreshCw } from 'lucide-react'

import { IntegrationNotice } from './IntegrationNotice.component'
import { useCooldown } from '../hooks/cooldown.hook'
import { INFRA_ERROR_CODE, type InfraAccessStatus } from '../constants/infra.constant'
import { useInfraMessages } from '../providers'
import { INTEGRATION_VERIFY_COOLDOWN_MS } from '../constants/infraIntegration.constant'
import { useResetMutationOnUnmount, useVerifyInfraIntegration } from '../hooks/infraIntegration.hook'
import { getErrorCode } from '../utils/errorCode.util'
import { resolveIntegrationErrorMessage } from '../utils/infraIntegration.util'
import { INFRA_BUTTON_SECONDARY } from '../constants/infraStyle.constant'

type VerifyAccessButtonProps = {
  readonly onVerified: (access: InfraAccessStatus) => void
}

function isRateLimited(error: unknown): boolean {
  const code = getErrorCode(error)

  return code === INFRA_ERROR_CODE.RATE_LIMITED || code === INFRA_ERROR_CODE.INFRA_PROVIDER_RATE_LIMITED
}

export function VerifyAccessButton({ onVerified }: VerifyAccessButtonProps) {
  const infraLocale = useInfraMessages()
  const locale = infraLocale.integration.status
  const { mutate, reset, isPending, isError, error } = useVerifyInfraIntegration()
  const { isCoolingDown, startCooldown } = useCooldown(INTEGRATION_VERIFY_COOLDOWN_MS)
  useResetMutationOnUnmount(reset)

  function handleVerify() {
    mutate(undefined, {
      onSuccess: (result) => onVerified(result.access),
      onError: (failure) => {
        if (isRateLimited(failure)) startCooldown()
      },
    })
  }

  return (
    <div className="space-y-2">
      <button
        className={INFRA_BUTTON_SECONDARY}
        disabled={isPending || isCoolingDown}
        onClick={handleVerify}
        type="button"
      >
        <RefreshCw aria-hidden="true" className={`size-4 ${isPending ? 'motion-safe:animate-spin' : ''}`} />
        {isPending ? locale.verifying : locale.verify}
      </button>
      {isCoolingDown ? <IntegrationNotice isInformational message={locale.verifyCooldown} /> : null}
      {isError && !isCoolingDown ? (
        <IntegrationNotice isInformational={false} message={resolveIntegrationErrorMessage(error, infraLocale)} />
      ) : null}
    </div>
  )
}
