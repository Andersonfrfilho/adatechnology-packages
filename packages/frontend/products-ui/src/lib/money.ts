/**
 * Dinheiro em centavos inteiros. Nenhuma operação aqui converte para float antes de arredondar —
 * um preço de venda que "quase" bate é defeito silencioso, e float acumula erro justamente nas
 * contas de margem.
 */

export type MoneyFormat = {
  readonly currency: string
  readonly locale: string
}

export function formatMoney(amountInCents: number, { currency, locale }: MoneyFormat): string {
  const amount = Number.isFinite(amountInCents) ? amountInCents : 0
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount / 100)
}

// Máscara de digitação: o usuário digita só dígitos e eles entram pela direita, como em terminal
// de caixa. Devolver os centavos junto com o texto evita que quem chama tenha de reinterpretar a
// string formatada — que é onde separador de milhar e de decimal por locale costuma quebrar.
export function maskMoneyInput(
  rawValue: string,
  format: MoneyFormat,
): { readonly text: string; readonly amountInCents: number } {
  const digits = rawValue.replace(/\D/g, '')
  if (digits === '') return { text: '', amountInCents: 0 }

  const amountInCents = Number.parseInt(digits, 10)
  return { text: formatMoney(amountInCents, format), amountInCents }
}

// Margem sobre o custo: preço = custo / (1 - margem). Arredonda uma única vez, no fim.
export function applyMarginToCost(costInCents: number, marginPercent: number): number {
  if (costInCents <= 0 || marginPercent <= 0 || marginPercent >= 100) return costInCents
  return Math.round(costInCents / (1 - marginPercent / 100))
}

export function formatMarginPercent(costInCents: number, priceInCents: number): string {
  if (costInCents <= 0 || priceInCents <= 0) return '—'
  return `${Math.round(((priceInCents - costInCents) / priceInCents) * 100)}%`
}
