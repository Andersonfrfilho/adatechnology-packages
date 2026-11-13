/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { ExternalLink, Info } from 'lucide-react'

import { useInfraMessages } from '../providers'
import { INFRA_INTEGRATION_SOURCE } from '../constants/infraIntegration.constant'
import type { InfraTokenSource } from '../providers'
import type { InfraIntegrationView } from '../types/infraIntegration.types'

type IntegrationNoticesProps = {
  readonly view: InfraIntegrationView
  readonly tokenSource?: InfraTokenSource
}

const NOTICE_CLASSES =
  'flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100'

/** Avisos que nao somem: o que o painel NAO faz (revogar no provedor) e quem manda quando ha duas fontes. */
export function IntegrationNotices({ view, tokenSource }: IntegrationNoticesProps) {
  const infraLocale = useInfraMessages()
  const locale = infraLocale.integration.notices
  const isEnvironmentSource = view.source === INFRA_INTEGRATION_SOURCE.ENVIRONMENT
  const isPanelSource = view.source === INFRA_INTEGRATION_SOURCE.PANEL

  return (
    <div className="space-y-2">
      {isPanelSource ? <RevokeWarning tokenSource={tokenSource} /> : null}
      {isEnvironmentSource ? <NoticeLine message={locale.environmentManaged} /> : null}
      {view.environmentTokenAlsoPresent ? <NoticeLine message={locale.environmentAlsoPresent} /> : null}
    </div>
  )
}

type NoticeLineProps = { readonly message: string }

function NoticeLine({ message }: NoticeLineProps) {
  return (
    <p className={NOTICE_CLASSES} role="note">
      <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <span>{message}</span>
    </p>
  )
}

type RevokeWarningProps = { readonly tokenSource?: InfraTokenSource }

function RevokeWarning({ tokenSource }: RevokeWarningProps) {
  const infraLocale = useInfraMessages()
  const locale = infraLocale.integration.notices

  if (!tokenSource) return <NoticeLine message={locale.revokeGeneric} />

  return (
    <p className={NOTICE_CLASSES} role="note">
      <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <span>
        {locale.revokePrefix}{' '}
        <a
          className="inline-flex items-center gap-1 font-medium underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          href={tokenSource.url}
          rel="noopener noreferrer"
          target="_blank"
        >
          {tokenSource.label}
          <ExternalLink aria-hidden="true" className="size-3.5" />
          <span className="sr-only">{locale.externalLink}</span>
        </a>
        {locale.revokeSuffix}
      </span>
    </p>
  )
}
