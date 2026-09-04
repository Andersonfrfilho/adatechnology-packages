/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Máscara é decisão de EXIBIÇÃO. O banco guarda dígitos (`security.md`, e a normalização do
 * módulo), e é aqui que eles voltam a ser legíveis — num lugar só, para as telas não divergirem.
 */

/**
 * `5516993056772` → `+55 (16) 99305-6772`.
 *
 * Número que não casa com nenhum formato conhecido sai como veio. Inventar parênteses em cima de
 * um número estrangeiro deixaria a tela mentindo sobre a forma dele.
 */
export function formatPhone(digits: string): string {
  const clean = digits.replace(/\D/g, '')

  const brazilian = /^55(\d{2})(\d{4,5})(\d{4})$/.exec(clean)
  if (brazilian) return `+55 (${brazilian[1]}) ${brazilian[2]}-${brazilian[3]}`

  const national = /^(\d{2})(\d{4,5})(\d{4})$/.exec(clean)
  if (national) return `(${national[1]}) ${national[2]}-${national[3]}`

  return digits
}

/**
 * Telefone MASCARADO na listagem: `+55 (16) •••••-6772`.
 *
 * O que sobra são os quatro últimos, que é o que uma pessoa usa para reconhecer o próprio número
 * sem que a tela exponha a lista inteira de contatos para quem só está procurando um cliente.
 */
export function maskPhone(digits: string): string {
  const clean = digits.replace(/\D/g, '')
  if (clean.length < 4) return '••••'

  const formatted = formatPhone(clean)
  // O prefixo continua visível — é o DDD que diz de onde a pessoa é, e não identifica ninguém
  // sozinho. Some o miolo; ficam os quatro finais, que é como alguém reconhece o próprio número.
  const visiblePrefix = formatted.startsWith('+') ? 4 : 2
  const lastVisible = clean.length - 4

  let seen = -1
  return formatted.replace(/\d/g, (digit) => {
    seen += 1
    return seen >= visiblePrefix && seen < lastVisible ? '•' : digit
  })
}

/**
 * Aplica uma máscara declarativa: `###.###.###-##`.
 *
 * `#` é dígito; qualquer outro caractere é separador literal. Vem do catálogo, e não de um `switch`
 * por tipo de documento — foi essa a razão de os documentos virarem lista configurável.
 */
export function applyMask(value: string, mask?: string): string {
  if (!mask) return value

  const digits = value.replace(/\D/g, '')
  let index = 0
  let result = ''

  for (const character of mask) {
    if (index >= digits.length) break
    if (character === '#') {
      result += digits[index]
      index += 1
    } else {
      result += character
    }
  }

  // Sobrou dígito além do que a máscara comporta: sai cru, em vez de ser truncado em silêncio.
  return index < digits.length ? value : result
}

export function formatDate(value: string | Date | undefined): string {
  if (!value) return ''
  const date = typeof value === 'string' ? new Date(value) : value
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('pt-BR')
}
