import { Check, ImagePlus, Scissors, X } from 'lucide-react'
import { useState, useCallback, useRef, type DragEvent, type ChangeEvent } from 'react'

import { compressImage, PRODUCT_IMAGE_MAX_BYTES } from './compressImage'
import { BACKGROUND_FILL } from './removeBackground'
import { useBackgroundRemoval } from './useBackgroundRemoval.hook'
import { useProductsConfig } from './providers/ProductsProvider'

export type ImageUploadProps = {
  readonly onUpload: (file: File) => Promise<string>
  readonly currentUrl?: string
}

export function ImageUpload({ onUpload, currentUrl }: ImageUploadProps) {
  const { backgroundRemoval } = useProductsConfig()
  const [preview, setPreview] = useState<string | null>(currentUrl ?? null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  // O arquivo original fica retido para o recorte de fundo poder ser tentado depois do envio.
  const [sourceFile, setSourceFile] = useState<File | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const cutout = useBackgroundRemoval({
    file: sourceFile,
    ...(backgroundRemoval ? { config: backgroundRemoval } : {}),
  })

  const processFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Apenas imagens são permitidas')
      return
    }
    setError(null)
    setSourceFile(file)
    setUploading(true)

    try {
      const localPreview = URL.createObjectURL(file)
      setPreview(localPreview)

      // Foto de celular passa dos 5MB com frequência, e o operador não tem editor à mão.
      const compressed = await compressImage({ file })

      if (compressed.size > PRODUCT_IMAGE_MAX_BYTES) {
        setError('Imagem deve ter no máximo 5MB')
        setPreview(currentUrl ?? null)
        return
      }

      const url = await onUpload(compressed)
      setPreview(url)
    } catch {
      setError('Erro ao enviar imagem')
      if (currentUrl) {
        setPreview(currentUrl)
      } else {
        setPreview(null)
      }
    } finally {
      setUploading(false)
    }
  }, [onUpload, currentUrl])

  const handleFileChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
  }, [processFile])

  const handleDrop = useCallback((e: DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) processFile(file)
  }, [processFile])

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault()
    setDragOver(false)
  }, [])

  const handleRemove = useCallback(() => {
    setPreview(null)
    setSourceFile(null)
    if (inputRef.current) inputRef.current.value = ''
  }, [])

  const handleApplyCutout = useCallback(async () => {
    if (!cutout.result) return

    setError(null)
    setUploading(true)

    try {
      const url = await onUpload(await compressImage({ file: cutout.result }))
      setPreview(url)
      cutout.discard()
    } catch {
      setError('Erro ao enviar imagem')
    } finally {
      setUploading(false)
    }
  }, [cutout, onUpload])

  return (
    <div>
      {preview ? (
        <div className="relative inline-block">
          <img
            src={preview}
            alt="Preview"
            className="w-32 h-32 rounded-lg object-cover bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
          />
          <button
            type="button"
            onClick={handleRemove}
            className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors shadow-sm"
            title="Remover imagem"
            aria-label="Remover imagem"
          >
            <X aria-hidden="true" className="w-3.5 h-3.5" />
          </button>
          {uploading && (
            <div className="absolute inset-0 bg-black bg-opacity-40 rounded-lg flex items-center justify-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white" />
            </div>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={`w-32 h-32 border-2 border-dashed rounded-lg flex flex-col items-center justify-center cursor-pointer transition-colors ${
            dragOver
              ? 'border-brand-500 bg-brand-50'
              : 'border-gray-300 dark:border-gray-700 hover:border-gray-400 bg-gray-50 dark:bg-gray-800'
          }`}
        >
          {uploading ? (
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-600" />
          ) : (
            <>
              <ImagePlus aria-hidden="true" className="w-6 h-6 text-gray-400 dark:text-gray-500 mb-1" />
              <span className="text-xs text-gray-400 dark:text-gray-500 text-center px-2">
                Clique ou arraste
              </span>
            </>
          )}
        </button>
      )}

      {cutout.available && preview && (
        <div className="mt-2">
          {cutout.result && cutout.previewUrl ? (
            <div className="flex items-start gap-3 flex-wrap">
              <figure className="m-0">
                <img
                  src={cutout.previewUrl}
                  alt="Prévia do produto sem fundo"
                  className="w-32 h-32 rounded-lg object-cover border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800"
                />
                <figcaption className="text-xs text-gray-500 dark:text-gray-400 mt-1">Sem fundo</figcaption>
              </figure>

              <div className="flex flex-col gap-1">
                <button
                  type="button"
                  onClick={handleApplyCutout}
                  disabled={uploading || cutout.running}
                  className="min-h-11 px-3 inline-flex items-center gap-2 rounded-lg bg-brand-600 text-white text-sm hover:bg-brand-700 disabled:opacity-50 transition-colors"
                >
                  <Check aria-hidden="true" className="w-4 h-4" />
                  Aplicar
                </button>

                <button
                  type="button"
                  onClick={() =>
                    cutout.run(
                      cutout.fill === BACKGROUND_FILL.WHITE ? BACKGROUND_FILL.TRANSPARENT : BACKGROUND_FILL.WHITE,
                    )
                  }
                  disabled={cutout.running}
                  className="min-h-11 px-3 inline-flex items-center rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-200 hover:border-gray-400 disabled:opacity-50 transition-colors"
                >
                  {cutout.fill === BACKGROUND_FILL.WHITE ? 'Deixar transparente' : 'Fundo branco'}
                </button>

                <button
                  type="button"
                  onClick={cutout.discard}
                  disabled={cutout.running}
                  className="min-h-11 px-3 inline-flex items-center rounded-lg text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 disabled:opacity-50 transition-colors"
                >
                  Descartar
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => cutout.run()}
              disabled={cutout.running || uploading}
              className="min-h-11 px-3 inline-flex items-center gap-2 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-200 hover:border-gray-400 disabled:opacity-50 transition-colors"
            >
              <Scissors aria-hidden="true" className="w-4 h-4" />
              {cutout.running ? 'Recortando…' : 'Remover fundo'}
            </button>
          )}

          {cutout.running && (
            // O modelo pesa alguns MB e é baixado na primeira vez: sem este aviso a espera parece travamento.
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Na primeira vez o modelo é baixado; pode levar alguns segundos.
            </p>
          )}
          {cutout.error && <p className="text-xs text-red-500 mt-1">{cutout.error}</p>}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />

      {error && (
        <p className="mt-2 text-xs text-red-500">{error}</p>
      )}
    </div>
  )
}
