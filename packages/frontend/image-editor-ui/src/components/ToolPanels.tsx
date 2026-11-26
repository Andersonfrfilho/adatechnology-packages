/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import type { ReactNode } from 'react'

import { Icon } from './Icon'
import { Slider } from './Slider'
import type { Adjustments, AspectPreset, ImageEditorLabels } from '../types'

type CropPanelProps = {
  readonly labels: ImageEditorLabels
  readonly presets: readonly AspectPreset[]
  readonly presetId: string
  readonly zoom: number
  readonly onSelectPreset: (preset: AspectPreset) => void
  readonly onZoom: (zoom: number) => void
  readonly onRotate: (direction: 'clockwise' | 'counterclockwise') => void
  readonly onFlip: (axis: 'horizontal' | 'vertical') => void
}

export function CropPanel({ labels, presets, presetId, zoom, onSelectPreset, onZoom, onRotate, onFlip }: CropPanelProps): ReactNode {
  return (
    <>
      <div className="aie-chips" role="radiogroup" aria-label={labels.aspectAria}>
        {presets.map((preset) => (
          <button key={preset.id} type="button" role="radio" aria-checked={preset.id === presetId} className="aie-chip" onClick={() => onSelectPreset(preset)}>
            {preset.label}
          </button>
        ))}
      </div>
      <Slider label={labels.zoom} value={Math.round(zoom * 100) / 100} min={1} max={6} step={0.05} valueText={`${Math.round(zoom * 100)}%`} onChange={onZoom} />
      <div className="aie-tools">
        <button type="button" className="aie-tool" onClick={() => onRotate('counterclockwise')} aria-label={labels.rotateLeft} data-tip={labels.rotateLeft}><Icon name="rotate-left" /></button>
        <button type="button" className="aie-tool" onClick={() => onRotate('clockwise')} aria-label={labels.rotateRight} data-tip={labels.rotateRight}><Icon name="rotate-right" /></button>
        <button type="button" className="aie-tool" onClick={() => onFlip('horizontal')} aria-label={labels.flipHorizontal} data-tip={labels.flipHorizontal}><Icon name="flip-horizontal" /></button>
        <button type="button" className="aie-tool" onClick={() => onFlip('vertical')} aria-label={labels.flipVertical} data-tip={labels.flipVertical}><Icon name="flip-vertical" /></button>
      </div>
    </>
  )
}

type AdjustPanelProps = {
  readonly labels: ImageEditorLabels
  readonly adjustments: Adjustments
  readonly onChange: (key: keyof Adjustments, value: number) => void
}

export function AdjustPanel({ labels, adjustments, onChange }: AdjustPanelProps): ReactNode {
  return (
    <>
      <Slider label={labels.brightness} value={adjustments.brightness} min={-100} max={100} step={1} onChange={(value) => onChange('brightness', value)} />
      <Slider label={labels.contrast} value={adjustments.contrast} min={-100} max={100} step={1} onChange={(value) => onChange('contrast', value)} />
    </>
  )
}

type TextPanelProps = { readonly labels: ImageEditorLabels; readonly altText: string; readonly onChange: (altText: string) => void }

export function TextPanel({ labels, altText, onChange }: TextPanelProps): ReactNode {
  return (
    <label className="aie-field">
      <span className="aie-field-label">{labels.altLabel}</span>
      <textarea className="aie-textarea" rows={3} maxLength={300} value={altText} placeholder={labels.altPlaceholder} onChange={(event) => onChange(event.target.value)} />
      <span className="aie-field-hint">{labels.altHint}</span>
    </label>
  )
}
