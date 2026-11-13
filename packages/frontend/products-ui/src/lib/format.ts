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
