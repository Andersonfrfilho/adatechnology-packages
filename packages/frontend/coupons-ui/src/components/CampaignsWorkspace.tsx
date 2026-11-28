/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * A tela composta do painel: lista ↔ campanha (configuração, códigos, contatos, usos, relatório).
 * É o padrão de consumo — o host usa a tela inteira e customiza por `messages`, slots de render
 * (no provider) e callbacks.
 */

import type { Campaign } from '@adatechnology/coupon-contracts'
import { ArrowLeft } from 'lucide-react'
import { useState } from 'react'

import { useCouponsAdminApi, useCouponsText } from '../providers/CouponsProvider'
import { CampaignDetail } from './CampaignDetail'
import { CampaignEditor } from './CampaignEditor'
import { CampaignList } from './CampaignList'

type WorkspaceView =
  { readonly kind: 'list' } | { readonly kind: 'new' } | { readonly kind: 'detail'; readonly campaign: Campaign }

export type CampaignsWorkspaceProps = {
  /** Busca, situação, ordem e página da lista na URL (padrão: sim). */
  readonly syncUrl?: boolean
  readonly onCampaignSaved?: (campaign: Campaign) => void
  /**
   * Só leitura (ex.: recepção com o escopo `leadReadScopes`): lista e abre campanhas, vê os contatos;
   * sem criar, editar, excluir nem lote. A API injetada continua decidindo o resto (sem `exportRecords`,
   * sem "todos os resultados").
   */
  readonly readOnly?: boolean
}

export function CampaignsWorkspace({ syncUrl = true, onCampaignSaved, readOnly = false }: CampaignsWorkspaceProps) {
  const api = useCouponsAdminApi()
  const { messages } = useCouponsText()
  const [view, setView] = useState<WorkspaceView>({ kind: 'list' })
  const [reloadKey, setReloadKey] = useState(0)

  function handleSaved(campaign: Campaign): void {
    setReloadKey((value) => value + 1)
    // Campanha nova salva vira edição dela: um segundo "salvar" não cria outra.
    setView({ kind: 'detail', campaign })
    onCampaignSaved?.(campaign)
  }

  async function handleOpen(id: string): Promise<void> {
    setView({ kind: 'detail', campaign: await api.getCampaign(id) })
  }

  if (view.kind === 'new') {
    return (
      <section className="acp-root acp-detail" aria-label={messages.newCampaign}>
        <header className="acp-detail-head">
          <button type="button" className="acp-button acp-button--ghost" onClick={() => setView({ kind: 'list' })}>
            <ArrowLeft aria-hidden="true" className="acp-icon" />
            <span>{messages.back}</span>
          </button>
          <h2 className="acp-title">{messages.newCampaign}</h2>
        </header>
        <CampaignEditor onSaved={handleSaved} />
      </section>
    )
  }

  if (view.kind === 'detail') {
    return (
      <CampaignDetail
        campaign={view.campaign}
        onBack={() => setView({ kind: 'list' })}
        onSaved={handleSaved}
        readOnly={readOnly}
        onRemoved={() => {
          setReloadKey((value) => value + 1)
          setView({ kind: 'list' })
        }}
      />
    )
  }

  return (
    <CampaignList
      reloadKey={reloadKey}
      syncUrl={syncUrl}
      readOnly={readOnly}
      {...(readOnly ? {} : { onCreate: () => setView({ kind: 'new' }) })}
      onOpen={(campaign) => void handleOpen(campaign.id)}
    />
  )
}
