/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Estado do recorte de fundo: o componente só desenha o que este hook expõe.
 *
 * O recorte **não é aplicado sozinho**. O modelo às vezes come a alça da bolsa ou corta a sombra
 * pela metade, e um produto mutilado no catálogo só é descoberto pelo cliente do outro lado. Por
 * isso o resultado fica em espera, ao lado do original, até alguém aprovar.
 */

import { useCallback, useEffect, useRef, useState } from 'react'

import {
  BACKGROUND_FILL,
  removeBackground,
  type BackgroundFill,
  type BackgroundRemovalConfig,
} from './removeBackground'

export type UseBackgroundRemovalParams = {
  readonly file: File | null
  readonly config?: BackgroundRemovalConfig
}

export type UseBackgroundRemovalResult = {
  readonly available: boolean
  readonly running: boolean
  readonly error: string | null
  readonly result: File | null
  readonly previewUrl: string | null
  readonly fill: BackgroundFill
  run(fill?: BackgroundFill): Promise<void>
  discard(): void
}

export function useBackgroundRemoval({ file, config }: UseBackgroundRemovalParams): UseBackgroundRemovalResult {
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [fill, setFill] = useState<BackgroundFill>(BACKGROUND_FILL.WHITE)

  // A URL de objeto é revogada na troca e no desmonte: sem isso cada tentativa vaza o blob inteiro.
  const previewUrlRef = useRef<string | null>(null)
  const replacePreview = useCallback((next: string | null) => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
    previewUrlRef.current = next
    setPreviewUrl(next)
  }, [])

  useEffect(() => () => replacePreview(null), [replacePreview])

  const discard = useCallback(() => {
    replacePreview(null)
    setResult(null)
    setError(null)
  }, [replacePreview])

  // Trocar de arquivo invalida o recorte do arquivo anterior.
  useEffect(() => {
    discard()
  }, [file, discard])

  const run = useCallback(
    async (nextFill?: BackgroundFill) => {
      if (!file || !config) return

      const chosenFill = nextFill ?? fill
      setFill(chosenFill)
      setError(null)
      setRunning(true)

      try {
        const cut = await removeBackground({ file, config, fill: chosenFill })
        setResult(cut)
        replacePreview(URL.createObjectURL(cut))
      } catch {
        setError('Não foi possível remover o fundo')
        setResult(null)
        replacePreview(null)
      } finally {
        setRunning(false)
      }
    },
    [file, config, fill, replacePreview],
  )

  return {
    available: Boolean(file && config),
    running,
    error,
    result,
    previewUrl,
    fill,
    run,
    discard,
  }
}
