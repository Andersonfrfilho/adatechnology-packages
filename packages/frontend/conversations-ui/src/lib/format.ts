export function formatTimestamp(timestamp: string): string {
  try {
    const date = new Date(timestamp)
    const hours = date.getHours().toString().padStart(2, '0')
    const minutes = date.getMinutes().toString().padStart(2, '0')
    return `${hours}:${minutes}`
  } catch {
    return timestamp
  }
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

const FILE_SIZE_UNITS = ['B', 'KB', 'MB', 'GB'] as const

export function formatFileSize(bytes: number): string {
  if (!isFinite(bytes) || bytes < 0) return ''
  if (bytes < 1) return '0 B'

  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), FILE_SIZE_UNITS.length - 1)
  const value = bytes / 1024 ** exponent
  const formatted = exponent === 0 ? value.toString() : value.toFixed(value < 10 ? 1 : 0)

  return `${formatted} ${FILE_SIZE_UNITS[exponent]}`
}
