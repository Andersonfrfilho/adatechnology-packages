export interface LightboxLabels {
  /** Texto alternativo quando a imagem não tem legenda — sem ele o leitor de tela anuncia a URL. */
  imageAlt: string
  close: string
}

export interface LightboxProps {
  imageUrl: string
  caption?: string
  onClose: () => void
  labels?: Partial<LightboxLabels>
}

export const DEFAULT_LIGHTBOX_LABELS: LightboxLabels = {
  imageAlt: 'Imagem',
  close: 'Fechar',
}

export function Lightbox({ imageUrl, caption, onClose, labels }: LightboxProps) {
  const imageAltLabel = labels?.imageAlt ?? DEFAULT_LIGHTBOX_LABELS.imageAlt
  const closeLabel = labels?.close ?? DEFAULT_LIGHTBOX_LABELS.close

  return (
    <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4" onClick={onClose}>
      <div className="max-w-[90vw] max-h-[90vh] flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
        <img src={imageUrl} alt={caption ?? imageAltLabel} className="max-w-full max-h-[80vh] object-contain rounded-lg" />
        {caption && <p className="text-white text-sm mt-3 text-center">{caption}</p>}
        <button onClick={onClose} className="mt-4 px-4 py-2 bg-white/20 text-white rounded-lg hover:bg-white/30 transition-colors">{closeLabel}</button>
      </div>
    </div>
  )
}
