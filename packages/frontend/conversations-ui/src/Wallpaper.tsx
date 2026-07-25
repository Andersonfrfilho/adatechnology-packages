import type { ReactNode } from 'react'

export interface ConversationWallpaperProps {
  children?: ReactNode
  className?: string
}

// Requer o import de '@adatechnology/conversations-ui/styles.css' uma vez no host —
// a classe `.cv-wallpaper` (e sua variante `.dark`) vive nesse stylesheet, não em CSS-in-JS,
// para não depender da configuração de Tailwind do consumidor.
export function ConversationWallpaper({ children, className = '' }: ConversationWallpaperProps) {
  return <div className={`cv-wallpaper ${className}`.trim()}>{children}</div>
}
