/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { useEffect, useMemo, useState, type ReactNode } from 'react'

import { imageEditorLabelsPtBr } from '../labels'
import { createInitialState } from '../lib/editState'
import { defaultOutputType, loadSource, type LoadedSource } from '../lib/loadSource'
import { FREE_PRESET_ID, buildDefaultPresets } from '../presets'
import type { ImageEditorProps } from '../types'

import { EditorWorkspace } from './EditorWorkspace'

const DEFAULT_MAX_OUTPUT_SIDE = 2400
const DEFAULT_QUALITY = 0.9

type LoadState = { readonly status: 'loading' } | { readonly status: 'error' } | { readonly status: 'ready'; readonly loaded: LoadedSource }

export function ImageEditor(props: ImageEditorProps): ReactNode {
  const { source, initialEdit, onSave, onCancel, onRevertToOriginal } = props
  const labels = useMemo(() => ({ ...imageEditorLabelsPtBr, ...props.labels }), [props.labels])
  const presets = useMemo(() => props.presets ?? buildDefaultPresets(labels), [props.presets, labels])
  const [load, setLoad] = useState<LoadState>({ status: 'loading' })

  useEffect(() => {
    let isCurrent = true
    setLoad({ status: 'loading' })
    loadSource(source).then(
      (loaded) => isCurrent && setLoad({ status: 'ready', loaded }),
      () => isCurrent && setLoad({ status: 'error' }),
    )
    return () => {
      isCurrent = false
    }
  }, [source])

  const initialPresetId = initialEdit?.presetId ?? props.initialPresetId ?? presets[0]?.id ?? FREE_PRESET_ID
  const preset = presets.find((item) => item.id === initialPresetId) ?? presets[0] ?? { id: FREE_PRESET_ID, label: '', aspect: undefined }

  return (
    <div className="aie-root">
      {load.status === 'loading' ? <p className="aie-status" role="status">{labels.loading}</p> : null}
      {load.status === 'error' ? <p className="aie-status aie-error" role="alert">{labels.loadError}</p> : null}
      {load.status === 'ready' ? (
        <EditorWorkspace
          image={load.loaded.image}
          initial={createInitialState({ naturalSize: load.loaded.naturalSize, preset, metadata: initialEdit })}
          presets={presets}
          labels={labels}
          renderOptions={{
            outputType: props.outputType ?? defaultOutputType(load.loaded.mimeType),
            outputQuality: props.outputQuality ?? DEFAULT_QUALITY,
            maxOutputSide: props.maxOutputSide ?? DEFAULT_MAX_OUTPUT_SIDE,
            maxOutputBytes: props.maxOutputBytes,
          }}
          isSaving={props.isSaving ?? false}
          onSave={onSave}
          onCancel={onCancel}
          onRevertToOriginal={onRevertToOriginal}
        />
      ) : null}
    </div>
  )
}
