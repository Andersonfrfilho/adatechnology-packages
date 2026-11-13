/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Embute `src/templates/standard-email.pt-BR.html` em `src/templates/standardEmailTemplate.generated.ts`.
 * Rode `pnpm run generate:standard-email` depois de editar o `.html`; o teste de igualdade acusa o esquecimento.
 */
import { readFileSync, writeFileSync } from 'node:fs'

const html = readFileSync(new URL('../src/templates/standard-email.pt-BR.html', import.meta.url), 'utf8')
const source = `/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * GERADO por \`scripts/generate-standard-email.ts\` a partir de \`standard-email.pt-BR.html\`. Não edite à mão.
 */
export const STANDARD_EMAIL_PT_BR_HTML = ${JSON.stringify(html)}
`
writeFileSync(new URL('../src/templates/standardEmailTemplate.generated.ts', import.meta.url), source)
