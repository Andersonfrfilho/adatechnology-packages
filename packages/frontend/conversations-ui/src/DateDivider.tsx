import { useConversationLocales } from './ConversationLocalesProvider'
import { isSameDay } from './lib/format'

export interface DateDividerProps {
  iso: string
}

// Paridade com financiamento-imobiliario-bot/apps/web/src/components/DateDivider.tsx —
// sticky no topo do scroll, "Hoje"/"Ontem" localizados, senão data completa pt-BR.
export function DateDivider({ iso }: DateDividerProps) {
  const { dateDivider } = useConversationLocales()

  return (
    <div className="flex justify-center sticky top-0 z-10 my-2 pointer-events-none">
      <span className="bg-white/95 dark:bg-gray-800/95 text-gray-600 dark:text-gray-300 text-xs font-medium px-3 py-1 rounded-lg shadow-sm">
        {formatDividerLabel(iso, dateDivider)}
      </span>
    </div>
  )
}

function formatDividerLabel(iso: string, dateDivider: { today: string; yesterday: string }): string {
  const date = new Date(iso)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)

  if (isSameDay(date, today)) return dateDivider.today
  if (isSameDay(date, yesterday)) return dateDivider.yesterday

  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
}
