/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { useId, useReducer, useState, type ReactNode } from 'react'

import { boundsOf, currentAspect, editReducer } from '../lib/editState'
import { CENTER_FOCAL_POINT } from '../lib/focalPoint'
import { zoomOf } from '../lib/geometry'
import { renderEdit, type DrawableImage, type RenderOptions } from '../lib/render'
import type { EditState, ImageEditResult, ImageEditorLabels, AspectPreset } from '../types'

import { EditorStage } from './EditorStage'
import { FocalPointPicker } from './FocalPointPicker'
import { Icon, type IconName } from './Icon'
import { AdjustPanel, CropPanel, TextPanel } from './ToolPanels'

type TabId = 'crop' | 'adjust' | 'focus' | 'text'

type EditorWorkspaceProps = {
  readonly image: DrawableImage
  readonly initial: EditState
  readonly presets: readonly AspectPreset[]
  readonly labels: ImageEditorLabels
  readonly renderOptions: RenderOptions
  readonly isSaving: boolean
  readonly onSave: (result: ImageEditResult) => void
  readonly onCancel: () => void
  readonly onRevertToOriginal?: () => void
}

export function EditorWorkspace({ image, initial, presets, labels, renderOptions, isSaving, onSave, onCancel, onRevertToOriginal }: EditorWorkspaceProps): ReactNode {
  const [state, dispatch] = useReducer((current: EditState, action: Parameters<typeof editReducer>[0]['action']) => editReducer({ state: current, action, presets }), initial)
  const [tab, setTab] = useState<TabId>('crop')
  const [isRendering, setIsRendering] = useState(false)
  const [hasFailed, setHasFailed] = useState(false)
  const helpId = useId()
  const aspect = currentAspect({ state, presets })
  const zoom = zoomOf({ rect: state.crop, bounds: boundsOf(state), aspect })
  const isBusy = isSaving || isRendering
  const tabs: readonly { id: TabId; label: string; icon: IconName }[] = [
    { id: 'crop', label: labels.tabCrop, icon: 'crop' },
    { id: 'adjust', label: labels.tabAdjust, icon: 'sliders' },
    { id: 'focus', label: labels.tabFocus, icon: 'target' },
    { id: 'text', label: labels.tabText, icon: 'text' },
  ]

  async function handleSave(): Promise<void> {
    setIsRendering(true)
    setHasFailed(false)
    try {
      onSave(await renderEdit({ image, state, options: renderOptions }))
    } catch {
      setHasFailed(true)
    } finally {
      setIsRendering(false)
    }
  }

  return (
    <div className="aie-body">
      <div className="aie-preview">
        {tab === 'focus' ? (
          <FocalPointPicker image={image} state={state} labels={labels} onChange={(point) => dispatch({ type: 'setFocalPoint', point })} />
        ) : (
          <EditorStage image={image} state={state} aspect={aspect} labels={labels} helpId={helpId} onCropChange={(crop) => dispatch({ type: 'setCrop', crop })} />
        )}
        <p id={helpId} className="aie-help">{labels.stageHelp}</p>
      </div>
      <div className="aie-side">
        <div className="aie-tabs" role="tablist" aria-label={labels.toolsAria}>
          {tabs.map((item) => (
            <button key={item.id} type="button" role="tab" id={`${helpId}-${item.id}`} aria-selected={tab === item.id} aria-controls={`${helpId}-panel`} className="aie-tab" onClick={() => setTab(item.id)}>
              <Icon name={item.icon} />
              {item.label}
            </button>
          ))}
        </div>
        <div className="aie-panel" role="tabpanel" id={`${helpId}-panel`} aria-labelledby={`${helpId}-${tab}`}>
          {tab === 'crop' ? (
            <CropPanel
              labels={labels} presets={presets} presetId={state.presetId} zoom={zoom}
              onSelectPreset={(preset) => dispatch({ type: 'selectPreset', preset })}
              onZoom={(value) => dispatch({ type: 'setZoom', zoom: value })}
              onRotate={(direction) => dispatch({ type: 'rotate', direction })}
              onFlip={(axis) => dispatch({ type: 'flip', axis })}
            />
          ) : null}
          {tab === 'adjust' ? <AdjustPanel labels={labels} adjustments={state.adjustments} onChange={(key, value) => dispatch({ type: 'setAdjustment', key, value })} /> : null}
          {tab === 'focus' ? (
            <>
              <p className="aie-hint">{labels.focusHint}</p>
              <button type="button" className="aie-button" onClick={() => dispatch({ type: 'setFocalPoint', point: CENTER_FOCAL_POINT })}>{labels.focusCenter}</button>
            </>
          ) : null}
          {tab === 'text' ? <TextPanel labels={labels} altText={state.altText} onChange={(altText) => dispatch({ type: 'setAltText', altText })} /> : null}
        </div>
        <p className="aie-size" aria-live="polite">{labels.resultSize}: {Math.round(state.crop.width)} × {Math.round(state.crop.height)} px</p>
        {hasFailed ? <p className="aie-error" role="alert">{labels.loadError}</p> : null}
        <div className="aie-actions">
          <button type="button" className="aie-button" disabled={isBusy} onClick={() => dispatch({ type: 'reset', initial })}><Icon name="undo" />{labels.reset}</button>
          {onRevertToOriginal ? <button type="button" className="aie-button" disabled={isBusy} onClick={onRevertToOriginal}><Icon name="original" />{labels.revertToOriginal}</button> : null}
          <span className="aie-spacer" />
          <button type="button" className="aie-button" disabled={isBusy} onClick={onCancel}>{labels.cancel}</button>
          <button type="button" className="aie-button aie-primary" disabled={isBusy} onClick={() => void handleSave()}><Icon name="check" />{isBusy ? labels.saving : labels.save}</button>
        </div>
      </div>
    </div>
  )
}
