function maskCnpj(value: string): string {
  const digits = value.replace(/\D/g, '')
  if (digits.length !== 14) return '**masked**'
  // Preserva UF raiz (2 dígitos) + sufixo filial (4) para identificação; oculta o centro
  return `${digits.slice(0, 2)}****${digits.slice(8, 12)}-**`
}

function maskCpf(value: string): string {
  const digits = value.replace(/\D/g, '')
  if (digits.length !== 11) return '**masked**'
  // Padrão BR: 420.***.***-90
  return `${digits.slice(0, 3)}.***.***-**`
}

function maskChaveAcesso(value: string): string {
  const digits = value.replace(/\D/g, '')
  if (digits.length !== 44) return '**masked**'
  // UF+AAMM visíveis no início, cNF visível no final para rastreio mínimo
  return `${digits.slice(0, 6)}...${digits.slice(-4)}`
}

function maskXmlResponse(value: string): string {
  return value
    .replace(/(<CNPJ>)(\d{14})(<\/CNPJ>)/g, '$1**masked**$3')
    .replace(/(<CPF>)(\d{11})(<\/CPF>)/g, '$1**masked**$3')
    .replace(/(<IE>)([^<]+)(<\/IE>)/g, '$1**masked**$3')
    .replace(/(<xNome>)([^<]+)(<\/xNome>)/g, '$1**masked**$3')
}

/**
 * Mascara campos sensíveis antes de gravar no log estruturado.
 * Aplica-se automaticamente no `log()` de cada provider — não chamar manualmente.
 */
export function obfuscateMeta(meta: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(meta)) {
    if (typeof value !== 'string') {
      result[key] = value
      continue
    }

    if (key === 'cnpj') { result[key] = maskCnpj(value); continue }
    if (key === 'cpf') { result[key] = maskCpf(value); continue }
    if (key === 'chaveAcesso') { result[key] = maskChaveAcesso(value); continue }
    if (key === 'rawResponse') { result[key] = maskXmlResponse(value); continue }

    result[key] = value
  }

  return result
}
