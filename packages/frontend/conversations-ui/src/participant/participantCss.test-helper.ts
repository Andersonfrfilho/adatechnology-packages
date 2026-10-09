import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { splitBlocks } from '../cssBlocks.test-helper'

export const PARTICIPANT_CSS = readFileSync(join(import.meta.dir, '..', 'styles.css'), 'utf8').replace(
  /\/\*[\s\S]*?\*\//g,
  '',
)

/** Declarations of every top-level rule whose selector list contains `selector`, or of the rules inside `scope`. */
export function declarationsIn(selector: string, scope: string = PARTICIPANT_CSS): Map<string, string> {
  const declarations = new Map<string, string>()
  for (const { prelude, body } of splitBlocks(scope)) {
    if (body === undefined || prelude.startsWith('@')) continue
    if (!prelude.split(',').some((entry) => entry.trim() === selector)) continue
    for (const declaration of body.split(';')) {
      const separator = declaration.indexOf(':')
      if (separator === -1) continue
      declarations.set(declaration.slice(0, separator).trim().toLowerCase(), declaration.slice(separator + 1).trim())
    }
  }
  return declarations
}

/** Inner CSS of the `@media <query>` block, or undefined when it does not exist. */
export function mediaBody(query: string): string | undefined {
  return splitBlocks(PARTICIPANT_CSS).find(({ prelude }) => prelude === `@media ${query}`)?.body
}

export function toRem(value: string | undefined): number {
  const match = /^(-?\d*\.?\d+)rem$/.exec(value ?? '')
  return match ? Number(match[1]) : 0
}
