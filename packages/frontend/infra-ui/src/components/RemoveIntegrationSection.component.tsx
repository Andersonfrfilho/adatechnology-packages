/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { useState } from 'react'

import { Trash2 } from 'lucide-react'

import { RemoveIntegrationDialog } from './RemoveIntegrationDialog.component'
import { useInfraMessages } from '../providers'
import type { InfraTokenSource } from '../providers'
import { INFRA_BUTTON_DANGER } from '../constants/infraStyle.constant'

type RemoveIntegrationSectionProps = {
  readonly onRemoved: () => void
  readonly tokenSource?: InfraTokenSource
}

export function RemoveIntegrationSection({ onRemoved, tokenSource }: RemoveIntegrationSectionProps) {
  const infraLocale = useInfraMessages()
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  return (
    <div>
      <button className={INFRA_BUTTON_DANGER} onClick={() => setIsDialogOpen(true)} type="button">
        <Trash2 aria-hidden="true" className="size-4" />
        {infraLocale.integration.remove.open}
      </button>
      {isDialogOpen ? (
        <RemoveIntegrationDialog
          onClose={() => setIsDialogOpen(false)}
          onRemoved={onRemoved}
          tokenSource={tokenSource}
        />
      ) : null}
    </div>
  )
}
