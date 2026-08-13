import { ImagePlus, X } from 'lucide-react'
import { useState, useCallback, useRef, type DragEvent, type ChangeEvent } from 'react'

export type ImageUploadProps = {
  readonly onUpload: (file: File) => Promise<string>
  readonly currentUrl?: string
}

export function ImageUpload({ onUpload, currentUrl }: ImageUploadProps) {
  const [preview, setPreview] = useState<string | null>(currentUrl ?? null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const processFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Apenas imagens são permitidas')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Imagem deve ter no máximo 5MB')
      return
    }

    setError(null)
    setUploading(true)

    try {
      const localPreview = URL.createObjectURL(file)
      setPreview(localPreview)

      const url = await onUpload(file)
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
    if (inputRef.current) inputRef.current.value = ''
  }, [])

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
