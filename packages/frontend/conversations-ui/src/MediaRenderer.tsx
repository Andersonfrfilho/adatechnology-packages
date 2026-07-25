import { AudioPlayer } from './AudioPlayer'
import type { MessagePayload } from './types'

function resolveMediaSource(message: MessagePayload): string | null {
  if (message.mediaUrl) return message.mediaUrl
  if (message.base64) {
    const prefix = message.mimeType
      ? `data:${message.mimeType};base64,`
      : 'data:application/octet-stream;base64,'
    return prefix + message.base64
  }
  return null
}

export interface MediaRendererProps {
  message: MessagePayload
  onLightbox: () => void
}

export function MediaRenderer({ message, onLightbox }: MediaRendererProps) {
  switch (message.type) {
    case 'image': {
      const src = resolveMediaSource(message)
      return (
        <div className="min-w-[200px]">
          {src ? (
            <img src={src} alt={message.caption ?? 'Image'} className="w-full max-h-80 object-cover cursor-pointer hover:opacity-90 transition-opacity" onClick={onLightbox} loading="lazy" />
          ) : (
            <div className="w-full h-40 bg-gray-200 flex items-center justify-center text-gray-400">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
            </div>
          )}
        </div>
      )
    }
    case 'video': {
      const src = resolveMediaSource(message)
      return (
        <div className="min-w-[200px]">
          {src ? (
            <video src={src} className="w-full max-h-80 rounded-lg" controls preload="metadata"><track kind="captions" /></video>
          ) : (
            <div className="w-full h-32 bg-gray-200 rounded-lg flex items-center justify-center text-gray-400">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" /></svg>
            </div>
          )}
        </div>
      )
    }
    case 'audio': {
      const src = resolveMediaSource(message)
      return (
        <div className="min-w-[200px]">
          {src ? <AudioPlayer audioUrl={src} direction={message.direction} /> : (
            <div className="h-12 bg-gray-200 rounded-lg flex items-center justify-center text-gray-400 text-xs">Audio unavailable</div>
          )}
        </div>
      )
    }
    case 'document': {
      const src = resolveMediaSource(message)
      const typeLabel = message.mimeType?.split('/')[1]?.toUpperCase() ?? 'FILE'
      return (
        <div className="flex items-center gap-3 min-w-[200px]">
          <div className="w-10 h-10 bg-gray-200 rounded-lg flex items-center justify-center flex-shrink-0">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-500"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{message.filename ?? 'Document'}</p>
            <p className="text-xs text-gray-500">{typeLabel}</p>
          </div>
          {src && (
            <a href={src} download={message.filename} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-200 hover:bg-gray-300 flex-shrink-0 transition-colors" aria-label="Download">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-600"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
            </a>
          )}
        </div>
      )
    }
    default:
      return null
  }
}
