/**
 * Escolha do template para o envio em lote.
 *
 * Fora da janela de 24h só template abre conversa, e a lista aprovada muda por conta da Meta — daí
 * a busca: quem tem trinta templates não acha o certo rolando. Só aparece quando o host implementa
 * `listTemplates`; sem a listagem não há o que escolher, e o envio cai no template padrão.
 *
 * O aviso de "nenhuma selecionada está fora da janela" existe porque o envio parecia falhar em
 * silêncio: dentro da janela a Meta recusa o template, e a tela não dizia por quê.
 */

import { useEffect, useMemo, useState } from 'react'

import { useConversations } from '../providers/ConversationsProvider'
import type { ConversationTemplate } from '../providers/types'
import type { ConversationsWorkspaceLabels } from './labels'

export interface BulkTemplateModalProps {
  readonly labels: ConversationsWorkspaceLabels
  /** Quantas das selecionadas estão fora da janela — as únicas que o template atinge. */
  readonly expiredCount: number
  readonly sending: boolean
  readonly onClose: () => void
  readonly onSend: (templateName: string | undefined) => void
}

export function BulkTemplateModal({
  labels,
  expiredCount,
  sending,
  onClose,
  onSend,
}: BulkTemplateModalProps) {
  const context = useConversations()
  if (!context) {
    throw new Error('BulkTemplateModal requires an ancestor <ConversationsProvider>')
  }
  const { api } = context

  const [templates, setTemplates] = useState<readonly ConversationTemplate[]>([])
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState('')

  useEffect(() => {
    let active = true
    void api
      .listTemplates?.()
      .then((loaded) => {
        if (active) setTemplates(loaded)
      })
      .catch(() => {
        // Lista vazia já comunica o que houve; um alerta a mais competiria com o atendimento.
      })
    return () => {
      active = false
    }
  }, [api])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return templates
    return templates.filter((template) => template.name.toLowerCase().includes(term))
  }, [templates, search])

  return (
    <div className="cv-workspace-modal" role="dialog" aria-modal="true" aria-label={labels.templateModalTitle}>
      <div className="cv-workspace-modal__box">
        <header className="cv-workspace-modal__header">
          <div>
            <h3>{labels.templateModalTitle}</h3>
            <p>{labels.templateModalAvailable(templates.length)}</p>
          </div>
          <button data-cv-tooltip={labels.templateModalCancel} type="button" onClick={onClose} aria-label={labels.templateModalCancel}>
            ✕
          </button>
        </header>

        <div className="cv-workspace-modal__search">
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={labels.templateModalSearch}
            autoFocus
          />
        </div>

        <div className="cv-workspace-modal__list">
          {filtered.length === 0 ? <p className="cv-workspace-empty">{labels.templateModalEmpty}</p> : null}
          {filtered.map((template) => (
            <button
              data-cv-tooltip={template.name} aria-label={template.name}
              key={template.name}
              type="button"
              // Reclicar desmarca: sem isso não havia como voltar ao template padrão depois de
              // escolher um por engano.
              onClick={() => setSelected(template.name === selected ? '' : template.name)}
              aria-pressed={template.name === selected}
              className={`cv-workspace-modal__item${
                template.name === selected ? ' cv-workspace-modal__item--on' : ''
              }`}
            >
              <span className="cv-workspace-modal__item-name">{template.name}</span>
              <span className="cv-workspace-modal__item-meta">
                {template.language}
                {template.category ? ` · ${template.category.toLowerCase()}` : ''}
              </span>
            </button>
          ))}
        </div>

        {expiredCount === 0 ? (
          <p className="cv-workspace-modal__warning">{labels.templateModalNoneExpired}</p>
        ) : null}

        <footer className="cv-workspace-modal__footer">
          <button data-cv-tooltip={labels.templateModalCancel} aria-label={labels.templateModalCancel} type="button" onClick={onClose}>
            {labels.templateModalCancel}
          </button>
          <button
            data-cv-tooltip={sending ? labels.templateModalSending : labels.templateModalSend(expiredCount)} aria-label={sending ? labels.templateModalSending : labels.templateModalSend(expiredCount)}
            type="button"
            disabled={sending || expiredCount === 0}
            onClick={() => onSend(selected || undefined)}
          >
            {sending ? labels.templateModalSending : labels.templateModalSend(expiredCount)}
          </button>
        </footer>
      </div>
    </div>
  )
}
