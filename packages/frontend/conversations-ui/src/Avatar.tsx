export interface AvatarLabels {
  /** Lido por leitor de tela quando não há nome nem imagem — a silhueta genérica. */
  unnamedContact: string
}

export interface AvatarProps {
  name?: string | null
  avatarUrl?: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
  labels?: Partial<AvatarLabels>
}

export const DEFAULT_AVATAR_LABELS: AvatarLabels = {
  unnamedContact: 'Contato sem nome',
}

const sizeClasses = {
  sm: 'w-6 h-6 text-xs',
  md: 'w-8 h-8 text-sm',
  lg: 'w-10 h-10 text-base',
}

const bgColors = [
  'bg-blue-500',
  'bg-green-500',
  'bg-purple-500',
  'bg-pink-500',
  'bg-yellow-500',
  'bg-red-500',
  'bg-indigo-500',
]

function getInitials(name: string | undefined | null): string {
  if (!name) return '?'
  const parts = name.trim().split(' ')
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return (parts[0]?.substring(0, 2) || '?').toUpperCase()
}

function getBgColor(name: string | undefined | null): string {
  if (!name) return 'bg-gray-400'
  const hash = name.charCodeAt(0) + (name.charCodeAt(name.length - 1) || 0)
  return bgColors[hash % bgColors.length]
}

// Paridade com financiamento-imobiliario-bot/apps/web/src/components/Avatar.tsx —
// mesmas iniciais (primeira+última letra), mesmo hash de cor, mesmas classes de tamanho.
export function Avatar({ name, avatarUrl, size = 'md', className = '', labels }: AvatarProps) {
  const sizeClass = sizeClasses[size]
  const unnamedContactLabel = labels?.unnamedContact ?? DEFAULT_AVATAR_LABELS.unnamedContact

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name || undefined}
        className={`${sizeClass} rounded-full object-cover flex-shrink-0 ${className}`}
      />
    )
  }

  const bgColor = getBgColor(name)

  // Sem nome e sem imagem, a silhueta genérica. Iniciais exigem nome — derivá-las de um telefone
  // produz rótulo sem significado ("+9"), que é pior que assumir o anonimato.
  if (!name) {
    return (
      <div
        className={`${sizeClass} ${bgColor} rounded-full flex items-center justify-center text-white flex-shrink-0 ${className}`}
        role="img"
        aria-label={unnamedContactLabel}
      >
        <svg viewBox="0 0 24 24" fill="currentColor" className="h-[60%] w-[60%]" aria-hidden>
          <path d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0 2c-4.42 0-8 2.24-8 5v1h16v-1c0-2.76-3.58-5-8-5Z" />
        </svg>
      </div>
    )
  }

  return (
    <div
      className={`${sizeClass} ${bgColor} rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0 ${className}`}
      title={name}
    >
      {getInitials(name)}
    </div>
  )
}
