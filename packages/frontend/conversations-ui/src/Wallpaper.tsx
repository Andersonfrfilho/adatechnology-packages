/**
 * Fundo da conversa — a textura clara/escura do WhatsApp.
 *
 * O fundo vem embutido, e não da folha de estilo do pacote: `styles.css` é um import opcional que o
 * host precisa lembrar de fazer, e esquecê-lo deixava a conversa sobre branco liso, sem erro nenhum
 * para denunciar o problema. Fundo é identidade do componente, não tema do host.
 *
 * A classe `cv-wallpaper` continua no elemento para quem já sobrescreve por CSS.
 */

import type { CSSProperties, ReactNode } from 'react'

import { cn } from './lib/cn'
import { useIsDarkTheme } from './useDarkMode'

/** Textura do WhatsApp: rabiscos esparsos que se repetem a cada 100px. */
function doodlePattern(strokeColor: string, opacity: number): string {
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'>` +
    `<g fill='none' stroke='${strokeColor}' stroke-width='1.2' opacity='${opacity}'>` +
    `<circle cx='15' cy='15' r='3'/><path d='M40 10 q5 8 0 16 q-5 -8 0 -16z'/>` +
    `<circle cx='70' cy='28' r='2'/><path d='M18 55 l6 6 m-6 0 l6 -6'/>` +
    `<circle cx='55' cy='68' r='2.5'/><path d='M85 58 q6 6 0 12 q-6 -6 0 -12z'/>` +
    `<circle cx='8' cy='85' r='2'/><path d='M65 90 l5 5 m-5 0 l5 -5'/>` +
    `</g></svg>`
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
}

const LIGHT_WALLPAPER: CSSProperties = {
  backgroundColor: '#efeae2',
  backgroundImage: doodlePattern('#d7cfc0', 0.7),
  backgroundRepeat: 'repeat',
  backgroundSize: '100px 100px',
}

const DARK_WALLPAPER: CSSProperties = {
  backgroundColor: '#0b141a',
  backgroundImage: doodlePattern('#19232a', 0.9),
  backgroundRepeat: 'repeat',
  backgroundSize: '100px 100px',
}

export interface ConversationWallpaperProps {
  children?: ReactNode
  className?: string
  /** Ajusta ou substitui o fundo padrão — para produto com identidade visual própria. */
  style?: CSSProperties
}

export function ConversationWallpaper({ children, className, style }: ConversationWallpaperProps) {
  const isDark = useIsDarkTheme()

  return (
    <div
      className={cn('cv-wallpaper', className)}
      style={{ ...(isDark ? DARK_WALLPAPER : LIGHT_WALLPAPER), ...style }}
    >
      {children}
    </div>
  )
}
