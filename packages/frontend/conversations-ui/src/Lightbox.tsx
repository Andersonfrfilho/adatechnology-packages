export interface LightboxProps {
  imageUrl: string
  caption?: string
  onClose: () => void
}

export function Lightbox({ imageUrl, caption, onClose }: LightboxProps) {
  return (
    <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4" onClick={onClose}>
      <div className="max-w-[90vw] max-h-[90vh] flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
        <img src={imageUrl} alt={caption ?? 'Image'} className="max-w-full max-h-[80vh] object-contain rounded-lg" />
        {caption && <p className="text-white text-sm mt-3 text-center">{caption}</p>}
        <button onClick={onClose} className="mt-4 px-4 py-2 bg-white/20 text-white rounded-lg hover:bg-white/30 transition-colors">Fechar</button>
      </div>
    </div>
  )
}
