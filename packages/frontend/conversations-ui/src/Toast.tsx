import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'

export type ToastType = 'success' | 'error' | 'info'

interface ToastItem {
  id: number
  type: ToastType
  message: string
}

interface ToastContextValue {
  show: (type: ToastType, message: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

let nextId = 0

let singletonShow: ((type: ToastType, message: string) => void) | null = null

export const toast = {
  show(type: ToastType, message: string) {
    if (singletonShow) {
      singletonShow(type, message)
    }
  },
}

const TOAST_CLOSE_LABEL = 'Fechar aviso'

const typeStyles: Record<ToastType, string> = {
  success: 'bg-green-600',
  error: 'bg-red-600',
  info: 'bg-blue-600',
}

const typeIcons: Record<ToastType, ReactNode> = {
  success: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  error: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
  info: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  ),
}

function ToastItemComponent({ item, onRemove }: { item: ToastItem; onRemove: (id: number) => void }) {
  const [exiting, setExiting] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      setExiting(true)
      setTimeout(() => onRemove(item.id), 300)
    }, 5000)
    return () => clearTimeout(timer)
  }, [item.id, onRemove])

  return (
    <div
      className={`flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-white text-sm min-w-[280px] max-w-[400px] ${
        typeStyles[item.type]
      } ${exiting ? 'animate-slide-out' : 'animate-slide-in'}`}
    >
      <span className="flex-shrink-0">{typeIcons[item.type]}</span>
      <span className="flex-1">{item.message}</span>
      <button
        onClick={() => {
          setExiting(true)
          setTimeout(() => onRemove(item.id), 300)
        }}
        data-cv-tooltip={TOAST_CLOSE_LABEL}
        aria-label={TOAST_CLOSE_LABEL}
        className="flex-shrink-0 opacity-70 hover:opacity-100 transition-opacity"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  )
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])

  const show = useCallback((type: ToastType, message: string) => {
    const id = ++nextId
    setItems((prev) => [...prev, { id, type, message }])
  }, [])

  const remove = useCallback((id: number) => {
    setItems((prev) => prev.filter((item) => item.id !== id))
  }, [])

  useEffect(() => {
    singletonShow = show
    return () => {
      singletonShow = null
    }
  }, [show])

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2">
        {items.map((item) => (
          <ToastItemComponent key={item.id} item={item} onRemove={remove} />
        ))}
      </div>
      <style>{`
        @keyframes slide-in {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slide-out {
          from { transform: translateX(0); opacity: 1; }
          to { transform: translateX(100%); opacity: 0; }
        }
        .animate-slide-in { animation: slide-in 0.3s ease-out; }
        .animate-slide-out { animation: slide-out 0.3s ease-in forwards; }
      `}</style>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}
