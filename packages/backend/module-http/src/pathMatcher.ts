/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Matcher mínimo de `/products/:id` — sem dependência de router externo, porque a
 * tabela de rotas precisa ser consumível por qualquer transporte (o `fetch` do Bun não tem
 * router, e o do uWS tem um formato próprio).
 */

export type CompiledPath = {
  readonly pattern: string
  readonly regex: RegExp
  readonly parameterNames: readonly string[]
}

const PARAMETER_PATTERN = /:([A-Za-z0-9_]+)/g

// Escapa tudo que é especial em regex, menos `:` (que vira grupo) — sem isso, um path com `.`
// casaria com qualquer caractere naquela posição.
function escapeLiteral(segment: string): string {
  return segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function compilePath(pattern: string): CompiledPath {
  const parameterNames: string[] = []
  const source = escapeLiteral(pattern).replace(PARAMETER_PATTERN, (_match, name: string) => {
    parameterNames.push(name)
    // `[^/]+` e não `.+`: um id não atravessa a barra, senão `/products/:id` engoliria
    // `/products/abc/reviews`.
    return '([^/]+)'
  })

  return { pattern, regex: new RegExp(`^${source}$`), parameterNames }
}

// H-4: `%` malformado (`%`, `%zz`) faz `decodeURIComponent` lançar `URIError`. Sem captura aqui,
// o erro escapa para o loop de roteamento do host antes de qualquer tratamento do módulo — e cada
// adaptador (fetch síncrono vs. uWS assíncrono) reage diferente à mesma requisição. Tratar como
// "não casou" (404) é a única resposta que os dois adaptadores dão de forma idêntica.
function tryDecodeUriComponent(value: string): string | undefined {
  try {
    return decodeURIComponent(value)
  } catch {
    return undefined
  }
}

export function matchPath(compiled: CompiledPath, pathname: string): Record<string, string> | undefined {
  const match = compiled.regex.exec(pathname)
  if (!match) return undefined

  const params: Record<string, string> = {}
  for (let index = 0; index < compiled.parameterNames.length; index += 1) {
    const name = compiled.parameterNames[index]
    const value = match[index + 1]
    if (value === undefined || name === undefined) continue
    const decoded = tryDecodeUriComponent(value)
    if (decoded === undefined) return undefined
    params[name] = decoded
  }
  return params
}
