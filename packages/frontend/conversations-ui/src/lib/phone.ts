export function formatPhone(number: string): string {
  const digits = number.replace(/\D/g, '')

  if (digits.length === 13) {
    return `+${digits.slice(0, 2)} (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9, 13)}`
  }

  if (digits.length === 12) {
    return `+${digits.slice(0, 2)} (${digits.slice(2, 4)}) ${digits.slice(4, 8)}-${digits.slice(8, 12)}`
  }

  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`
  }

  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6, 10)}`
  }

  return number
}

// Mapa explícito em vez de derivar o emoji do código: prefixos são ambíguos (1 = EUA e Canadá,
// 7 = Rússia e Cazaquistão) e mostrar a bandeira errada é pior do que não mostrar nenhuma.
const COUNTRY_FLAG_BY_DIAL_CODE: Readonly<Record<string, string>> = {
  '55': '🇧🇷',
  '351': '🇵🇹',
  '34': '🇪🇸',
  '54': '🇦🇷',
  '56': '🇨🇱',
  '57': '🇨🇴',
  '52': '🇲🇽',
  '598': '🇺🇾',
  '595': '🇵🇾',
  '44': '🇬🇧',
  '49': '🇩🇪',
  '39': '🇮🇹',
  '33': '🇫🇷',
}

/**
 * Devolve string vazia quando não reconhece o país — quem renderiza decide se some com o espaço.
 */
export function phoneCountryFlag(number: string): string {
  const digits = number.replace(/\D/g, '')

  // Do prefixo mais longo para o mais curto: '55' casaria antes de '551' e daria bandeira errada
  // em países de código de três dígitos.
  for (const length of [3, 2, 1]) {
    const flag = COUNTRY_FLAG_BY_DIAL_CODE[digits.slice(0, length)]
    if (flag) return flag
  }

  return ''
}

export function phoneInitials(number: string): string {
  const digits = number.replace(/\D/g, '')
  return digits.slice(-2)
}
