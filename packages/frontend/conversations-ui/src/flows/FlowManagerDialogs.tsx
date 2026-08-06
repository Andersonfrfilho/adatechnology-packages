/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Criar e excluir fluxo. Ficam fora do workspace porque são as duas únicas ações que mudam a LISTA
 * de fluxos, e não o desenho de um — o resto da tela edita rascunho, estas duas escrevem no
 * servidor na hora.
 */

import { useState } from 'react'

import type { FlowEditorLabels } from './labels'
import type { FlowsWorkspaceApi } from './useFlowsEditor'

/** Mesma regra que o servidor cobra na chave do fluxo — validar aqui evita ida e volta inútil. */
const FLOW_KEY_PATTERN = /^[a-z0-9_]{2,40}$/

type CreateFlowDialogProps = {
  readonly api: FlowsWorkspaceApi
  readonly labels: FlowEditorLabels
  readonly onClose: () => void
  readonly onCreated: (key: string) => void
}

export function CreateFlowDialog({ api, labels, onClose, onCreated }: CreateFlowDialogProps) {
  const [key, setKey] = useState('')
  const [label, setLabel] = useState('')
  const [showInMenu, setShowInMenu] = useState(false)
  const [menuOptionLabel, setMenuOptionLabel] = useState('')
  const [pending, setPending] = useState(false)
  const [failure, setFailure] = useState<string | undefined>(undefined)

  const keyIsValid = FLOW_KEY_PATTERN.test(key)

  async function handleCreate() {
    setPending(true)
    setFailure(undefined)
    try {
      await api.createFlow({
        key,
        label,
        showInMenu,
        // Campo vazio é ausência, não string vazia: o servidor decide o texto padrão.
        menuOptionLabel: showInMenu ? menuOptionLabel || label : undefined,
      })
      onCreated(key)
    } catch (error) {
      setFailure(error instanceof Error ? error.message : labels.flowManager.createError)
      setPending(false)
    }
  }

  return (
    <div className="cv-workspace-modal" role="dialog" aria-modal="true" aria-label={labels.flowManager.createTitle}>
      <div className="cv-workspace-modal__box">
        <div className="cv-workspace-modal__header">
          <h3>{labels.flowManager.createTitle}</h3>
        </div>

        <div className="cv-flows-dialog-body">
        <label className="cv-flows-field">
          <span>{labels.flowManager.label}</span>
          <input value={label} onChange={(event) => setLabel(event.target.value)} />
        </label>

        <label className="cv-flows-field">
          <span>{labels.flowManager.key}</span>
          <input value={key} onChange={(event) => setKey(event.target.value.toLowerCase())} />
          <small>{key && !keyIsValid ? labels.flowManager.keyInvalid : labels.flowManager.keyHint}</small>
        </label>

        <label className="cv-flows-check">
          <input type="checkbox" checked={showInMenu} onChange={(event) => setShowInMenu(event.target.checked)} />
          <span>{labels.flowManager.showInMenu}</span>
        </label>

        {showInMenu && (
          <label className="cv-flows-field">
            <span>{labels.flowManager.menuOptionLabel}</span>
            <input
              value={menuOptionLabel}
              onChange={(event) => setMenuOptionLabel(event.target.value)}
              placeholder={label}
            />
          </label>
        )}

        {failure && <p className="cv-workspace-failure">{failure}</p>}
        </div>

        <div className="cv-workspace-modal__footer">
          <button type="button" onClick={onClose}>
            {labels.nodePanel.cancel}
          </button>
          <button type="button" onClick={handleCreate} disabled={!keyIsValid || !label || pending}>
            {pending ? labels.flowManager.creating : labels.flowManager.create}
          </button>
        </div>
      </div>
    </div>
  )
}

type DeleteFlowDialogProps = {
  readonly api: FlowsWorkspaceApi
  readonly labels: FlowEditorLabels
  readonly flow: { readonly key: string; readonly label: string }
  readonly onClose: () => void
  readonly onDeleted: () => void
}

export function DeleteFlowDialog({ api, labels, flow, onClose, onDeleted }: DeleteFlowDialogProps) {
  const [pending, setPending] = useState(false)
  const [failure, setFailure] = useState<string | undefined>(undefined)

  async function handleDelete() {
    setPending(true)
    setFailure(undefined)
    try {
      await api.deleteFlow(flow.key)
      onDeleted()
    } catch (error) {
      setFailure(error instanceof Error ? error.message : labels.flowManager.deleteError)
      setPending(false)
    }
  }

  return (
    <div className="cv-workspace-modal" role="dialog" aria-modal="true" aria-label={labels.flowManager.deleteFlow}>
      <div className="cv-workspace-modal__box">
        <div className="cv-workspace-modal__header">
          <h3>{labels.flowManager.deleteFlow}</h3>
        </div>

        <div className="cv-flows-dialog-body">
          <p className="cv-flows-dialog-text">{labels.flowManager.deleteConfirm(flow.label)}</p>
          {failure && <p className="cv-workspace-failure">{failure}</p>}
        </div>

        {/* O modal já pinta o último botão do rodapé como primário — aqui ele é destrutivo. */}
        <div className="cv-workspace-modal__footer cv-flows-footer--danger">
          <button type="button" onClick={onClose}>
            {labels.nodePanel.cancel}
          </button>
          <button type="button" onClick={handleDelete} disabled={pending}>
            {labels.flowManager.deleteFlow}
          </button>
        </div>
      </div>
    </div>
  )
}
