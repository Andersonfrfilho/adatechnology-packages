/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Normalização de entrada, num lugar só.
 *
 * O banco guarda telefone e documento em UMA forma. Se cada chamador normalizasse do seu jeito, a
 * mesma pessoa viraria dois cadastros — e a busca não acharia nenhum dos dois.
 */

/**
 * Acima disto, o número já traz código de país. Um celular brasileiro sem DDI tem 11 dígitos
 * (`16993056772`); um fixo, 10. Com DDI, 13 e 12.
 */
const MAX_NATIONAL_LENGTH = 11

/**
 * `(16) 99305-6772` e `5516993056772` são a MESMA pessoa, e sem isto virariam dois cadastros.
 *
 * O canal sempre entrega com código de país; quem digita no painel, quase nunca. Tirar a máscara
 * não basta — foi o que um teste pegou aqui, com os dois formatos criando clientes diferentes.
 *
 * `defaultCountryCode` é CONFIGURAÇÃO e não constante: prefixar `55` dentro do pacote seria assumir
 * que todo produto que o consome é brasileiro. Sem ele, só a máscara sai — e aí o host é quem
 * precisa entregar o número completo.
 */
export function normalizePhone(value: string, defaultCountryCode?: string): string {
  const digits = value.replace(/\D/g, '')
  if (!defaultCountryCode || digits.length === 0) return digits
  if (digits.length > MAX_NATIONAL_LENGTH) return digits
  return `${defaultCountryCode.replace(/\D/g, '')}${digits}`
}

/** `123.456.789-01` e `12345678901` são o mesmo CPF — e a impressão do índice cego depende disso. */
export function normalizeDocument(value: string): string {
  return value.replace(/[^\dA-Za-z]/g, '').toUpperCase()
}

/**
 * O termo digitado na busca vira padrão de `ilike`.
 *
 * `%` e `_` são curingas do SQL: quem procura por "50%" quer o texto, não "qualquer coisa". E se o
 * termo é só dígito, ele também serve para casar telefone — que a pessoa digita com máscara e o
 * banco guarda sem.
 */
export function toSearchPattern(term: string): { readonly text: string; readonly digits?: string } {
  const escaped = term.replace(/[\\%_]/g, (match) => `\\${match}`)
  const digits = normalizePhone(term)
  return { text: `%${escaped}%`, ...(digits.length >= 3 ? { digits: `%${digits}%` } : {}) }
}
