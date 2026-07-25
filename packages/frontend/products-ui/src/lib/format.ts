export function formatBRL(value: number | string): string {
  const number = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(number)) return 'R$ 0,00'
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(number)
}

export function formatMargin(cost: number, price: number): string {
  if (!cost || !price || cost <= 0) return '—'
  const margin = ((price - cost) / price) * 100
  return `${Math.round(margin)}%`
}

export function formatBarcode(value: string): string {
  const digits = value.replace(/\D/g, '')
  if (digits.length === 13) {
    return `${digits.slice(0, 1)} ${digits.slice(1, 6)} ${digits.slice(6, 11)} ${digits.slice(11, 12)} ${digits.slice(12, 13)}`
  }
  if (digits.length === 8) {
    return `${digits.slice(0, 1)} ${digits.slice(1, 3)} ${digits.slice(3, 5)} ${digits.slice(5, 6)} ${digits.slice(6, 8)}`
  }
  if (digits.length >= 4) {
    const mid = Math.floor(digits.length / 2)
    return `${digits.slice(0, mid)} ${digits.slice(mid)}`
  }
  return digits
}

export function parseCurrency(value: string): number {
  const cleaned = value
    .replace(/[^\d,.-]/g, '')
    .replace(/\./g, '')
    .replace(',', '.')
  const number = parseFloat(cleaned)
  return isNaN(number) ? 0 : number
}
