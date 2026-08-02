/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Matcher mínimo de `/notifications/:id/read` — sem dependência de router externo, porque a
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
    // `[^/]+` e não `.+`: um id não atravessa a barra, senão `/notifications/:id` engoliria
    // `/notifications/abc/read`.
    return '([^/]+)'
  })

  return { pattern, regex: new RegExp(`^${source}$`), parameterNames }
}

export function matchPath(compiled: CompiledPath, pathname: string): Record<string, string> | undefined {
  const match = compiled.regex.exec(pathname)
  if (!match) return undefined

  const params: Record<string, string> = {}
  compiled.parameterNames.forEach((name, index) => {
    const value = match[index + 1]
    if (value !== undefined) params[name] = decodeURIComponent(value)
  })
  return params
}
