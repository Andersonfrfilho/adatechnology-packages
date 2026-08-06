/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * A tela inteira do editor de fluxos: barra de ações, abas de fluxo, mapa, canvas, painel de nó e os
 * diálogos de criar/excluir.
 *
 * É o que o produto consome — inteira, nunca em pedaços (`pluggable-module.md` §4). A primeira versão
 * disto era uma página de 973 linhas dentro do financiamento, e a única forma de o quickcart ter a
 * mesma tela era copiar o arquivo: foi assim que as telas divergiram entre os produtos antes.
 *
 * Customização é por contrato: `labels` para vocabulário, slots de render para UI do produto,
 * callbacks para regra de negócio, e capacidade opcional por AUSÊNCIA de prop.
 */

import { useMemo, useState, type ReactNode } from 'react'
import type { FlowGraphData, FlowNodeData } from '@adatechnology/meta-whatsapp-contracts'
import { AlertCircle, AlertTriangle, LayoutGrid, Map as MapIcon, Plus, Save, Trash2, Undo2, Workflow } from 'lucide-react'

import { cn } from '../lib/cn'
import { FlowMapCanvas } from './FlowMapCanvas'
import { FlowNodePanel } from './FlowNodePanel'
import { FlowPalette, type FlowPaletteActionOption } from './FlowPalette'
import { FlowEditorCanvas } from './FlowEditorCanvas'
import { CreateFlowDialog, DeleteFlowDialog } from './FlowManagerDialogs'
import { mergeFlowEditorLabels, type FlowEditorLabels } from './labels'
import { useFlowsEditor, type FlowsWorkspaceApi } from './useFlowsEditor'

type ViewMode = 'detail' | 'map'

export type FlowsWorkspaceProps = {
  readonly api: FlowsWorkspaceApi
  /** Fluxo por onde a tela abre, e a raiz do fecho transitivo que vem junto. */
  readonly rootFlowKey: string
  readonly labels?: Partial<FlowEditorLabels>
  /** Kinds de ação que este produto oferece na paleta — o pacote não conhece nenhum caso de negócio. */
  readonly actionOptions?: readonly FlowPaletteActionOption[]
  /**
   * Biblioteca de mídia do nó `send_media`.
   *
   * Slot porque upload, permissão e URL assinada são do produto. Ausente, o nó segue editável — só
   * não dá para anexar arquivo por aqui.
   */
  readonly renderMediaPicker?: ((node: FlowNodeData, graph: FlowGraphData) => ReactNode) | undefined
  readonly className?: string
}

export function FlowsWorkspace(props: FlowsWorkspaceProps) {
  const { api, rootFlowKey, actionOptions, renderMediaPicker, className } = props
  const labels = useMemo(() => mergeFlowEditorLabels(props.labels), [props.labels])

  const editor = useFlowsEditor({ api, rootFlowKey, labels })
  const [viewMode, setViewMode] = useState<ViewMode>('detail')
  const [isCreating, setIsCreating] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const { primaryGraph, primaryFlowKey, errorCount, warningCount, isDirty, saveState } = editor
  const isDetail = viewMode === 'detail'

  // O fluxo raiz nunca é excluível: sem ele o bot não tem por onde começar a conversa, e o erro só
  // apareceria para o cliente na próxima mensagem.
  const canDeletePrimary = primaryGraph !== undefined && primaryFlowKey !== rootFlowKey

  return (
    <div className={cn('cv-flows', className)}>
      <header className="cv-workspace-header cv-flows-header">
        <div>
          <h2>{labels.workspace.title}</h2>
          <p>{labels.workspace.subtitle}</p>
        </div>

        <div className="cv-flows-actions">
          {saveState === 'success' && <span className="cv-pill cv-pill--success">{labels.workspace.saveSuccess}</span>}
          {saveState === 'error' && (
            <span className="cv-pill cv-pill--danger">{editor.saveErrorMessage ?? labels.workspace.saveError}</span>
          )}

          <button
            type="button"
            className="cv-header-action"
            onClick={() => setViewMode(isDetail ? 'map' : 'detail')}
          >
            {isDetail ? <MapIcon size={14} aria-hidden="true" /> : <Workflow size={14} aria-hidden="true" />}
            {isDetail ? labels.flowMap.toggleToMap : labels.flowMap.toggleToDetail}
          </button>

          {isDetail && (
            <>
              <button
                type="button"
                className="cv-header-action"
                onClick={editor.organize}
                title={labels.workspace.organizeTooltip}
                disabled={!primaryGraph}
              >
                <LayoutGrid size={14} aria-hidden="true" />
                {labels.workspace.organize}
              </button>

              <button
                type="button"
                className="cv-header-action"
                onClick={editor.discard}
                title={labels.workspace.discardTooltip}
                disabled={!isDirty || saveState === 'saving'}
              >
                <Undo2 size={14} aria-hidden="true" />
                {labels.workspace.discardChanges}
              </button>

              <button
                type="button"
                className="cv-header-action cv-header-action--primary"
                onClick={editor.publish}
                disabled={!isDirty || errorCount > 0 || saveState === 'saving'}
              >
                <Save size={14} aria-hidden="true" />
                {saveState === 'saving' ? labels.workspace.saving : labels.workspace.saveGraph}
              </button>
            </>
          )}
        </div>
      </header>

      {isDetail && (
        <div className="cv-flows-tabs">
          <div className="cv-workspace-chips">
            {Object.values(editor.graphs ?? {}).map((graph) => (
              <button
                type="button"
                key={graph.key}
                className={cn('cv-workspace-chip', primaryFlowKey === graph.key && 'cv-workspace-chip--on')}
                onClick={() => editor.focusFlow(graph.key)}
              >
                {graph.label}
              </button>
            ))}
            <button type="button" className="cv-workspace-chip cv-flows-chip--new" onClick={() => setIsCreating(true)}>
              <Plus size={12} aria-hidden="true" />
              {labels.flowManager.newFlow}
            </button>
          </div>

          <div className="cv-flows-tools">
            {primaryGraph && (
              <FlowPalette
                onAdd={editor.addNode}
                labels={labels}
                {...(actionOptions === undefined ? {} : { actionOptions: [...actionOptions] })}
              />
            )}
            {canDeletePrimary && (
              <button type="button" className="cv-header-action cv-header-action--danger" onClick={() => setIsDeleting(true)}>
                <Trash2 size={13} aria-hidden="true" />
                {labels.flowManager.deleteFlow}
              </button>
            )}
          </div>
        </div>
      )}

      {isDetail && (errorCount > 0 || warningCount > 0) && (
        <div className="cv-workspace-alert">
          <strong>{labels.validation.title}</strong>
          {errorCount > 0 && (
            <span className="cv-pill cv-pill--danger">
              <AlertCircle size={13} aria-hidden="true" />
              {labels.validation.errors(errorCount)}
            </span>
          )}
          {warningCount > 0 && (
            <span className="cv-pill cv-pill--warning">
              <AlertTriangle size={13} aria-hidden="true" />
              {labels.validation.warnings(warningCount)}
            </span>
          )}
        </div>
      )}

      <div className="cv-flows-canvas">
        {editor.loading && <p className="cv-workspace-empty">{labels.workspace.loading}</p>}
        {editor.loadError && <p className="cv-workspace-failure">{labels.workspace.loadError}</p>}

        {!editor.loading && !editor.loadError && editor.graphs && viewMode === 'map' && (
          <FlowMapCanvas
            graphs={editor.graphs}
            rootKey={rootFlowKey}
            labels={labels}
            onOpenFlow={(key) => {
              editor.focusFlow(key)
              setViewMode('detail')
            }}
          />
        )}

        {!editor.loading && !editor.loadError && isDetail && primaryGraph && (
          <FlowEditorCanvas editor={editor} labels={labels} />
        )}
      </div>

      {/* `key` por nó: o painel guarda rascunho próprio em estado, e sem remontar ao trocar de nó ele
          seguia mostrando — e salvando — os campos do nó anterior. */}
      {editor.editingNode && editor.editingGraph && (
        <FlowNodePanel
          key={`${editor.editingRef?.flowKey}:${editor.editingRef?.nodeId}`}
          graph={editor.editingGraph}
          node={editor.editingNode}
          issues={editor.editingRef ? (editor.issuesByFlow[editor.editingRef.flowKey] ?? []) : []}
          otherFlows={editor.otherFlows}
          labels={labels}
          onClose={editor.closePanel}
          onChange={editor.changeNode}
          onDelete={editor.deleteNode}
          {...(renderMediaPicker === undefined
            ? {}
            : { renderMediaPicker: (node: FlowNodeData) => renderMediaPicker(node, editor.editingGraph!) })}
        />
      )}

      {isCreating && (
        <CreateFlowDialog
          api={api}
          labels={labels}
          onClose={() => setIsCreating(false)}
          onCreated={(key) => {
            setIsCreating(false)
            void editor.resetTo(key)
          }}
        />
      )}

      {isDeleting && primaryGraph && (
        <DeleteFlowDialog
          api={api}
          labels={labels}
          flow={{ key: primaryGraph.key, label: primaryGraph.label }}
          onClose={() => setIsDeleting(false)}
          onDeleted={() => {
            setIsDeleting(false)
            void editor.resetTo(rootFlowKey)
          }}
        />
      )}
    </div>
  )
}
