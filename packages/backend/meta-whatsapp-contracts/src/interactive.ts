import { InteractiveLimitExceededError } from './errors'
import { WHATSAPP_CHOICE_LIMIT } from './providers'

/** Botão de resposta rápida. `id` volta no webhook quando o cliente toca; `title` é o que ele lê. */
export type InteractiveButton = {
  readonly id: string
  readonly title: string
}

/** Linha de lista. `description` aparece em cinza abaixo do título. */
export type InteractiveListRow = {
  readonly id: string
  readonly title: string
  readonly description?: string | undefined
}

/**
 * Seção de lista. `title` só é obrigatório quando há mais de uma seção — é o que a Meta exige; com
 * uma seção só, o canal usa o rótulo do botão.
 */
export type InteractiveListSection = {
  readonly title?: string | undefined
  readonly rows: readonly InteractiveListRow[]
}

export type InteractiveButtonsMessage = {
  readonly kind: 'buttons'
  readonly body: string
  readonly buttons: readonly InteractiveButton[]
}

export type InteractiveListMessage = {
  readonly kind: 'list'
  readonly body: string
  /** Texto do botão que abre a lista. */
  readonly buttonLabel: string
  readonly sections: readonly InteractiveListSection[]
}

export type InteractiveMessage = InteractiveButtonsMessage | InteractiveListMessage

export type InteractiveLimitRule = 'required' | 'max-length' | 'min-count' | 'max-count' | 'duplicate-id'

/** Uma regra violada. `path` aponta o campo (`sections[1].rows[0].title`). */
export type InteractiveLimitViolation = {
  readonly path: string
  readonly rule: InteractiveLimitRule
  readonly limit?: number
  readonly actual?: number
}

/**
 * Conta por code point, não por unidade UTF-16: um emoji é UM caractere para quem escreve o texto, e
 * `'🙋'.length` daria 2.
 */
function characterCount(text: string): number {
  return Array.from(text).length
}

function checkText(params: {
  readonly path: string
  readonly text: string | undefined
  readonly maxLength: number
  readonly isRequired: boolean
}): InteractiveLimitViolation[] {
  const text = params.text ?? ''
  if (text.trim().length === 0) return params.isRequired ? [{ path: params.path, rule: 'required' }] : []
  const actual = characterCount(text)
  if (actual <= params.maxLength) return []
  return [{ path: params.path, rule: 'max-length', limit: params.maxLength, actual }]
}

function checkCount(path: string, actual: number, max: number): InteractiveLimitViolation[] {
  if (actual === 0) return [{ path, rule: 'min-count', limit: 1, actual }]
  if (actual > max) return [{ path, rule: 'max-count', limit: max, actual }]
  return []
}

function checkDuplicateIds(
  entries: readonly { readonly path: string; readonly id: string }[],
): InteractiveLimitViolation[] {
  const seen = new Set<string>()
  return entries.flatMap((entry) => {
    if (!seen.has(entry.id)) {
      seen.add(entry.id)
      return []
    }
    return [{ path: entry.path, rule: 'duplicate-id' as const }]
  })
}

function buttonsViolations(message: InteractiveButtonsMessage): InteractiveLimitViolation[] {
  const buttonViolations = message.buttons.flatMap((button, index) => [
    ...checkText({
      path: `buttons[${index}].id`,
      text: button.id,
      maxLength: WHATSAPP_CHOICE_LIMIT.BUTTON_ID_LENGTH,
      isRequired: true,
    }),
    ...checkText({
      path: `buttons[${index}].title`,
      text: button.title,
      maxLength: WHATSAPP_CHOICE_LIMIT.BUTTON_TITLE_LENGTH,
      isRequired: true,
    }),
  ])
  return [
    ...checkCount('buttons', message.buttons.length, WHATSAPP_CHOICE_LIMIT.BUTTONS),
    ...buttonViolations,
    ...checkDuplicateIds(message.buttons.map((button, index) => ({ path: `buttons[${index}].id`, id: button.id }))),
  ]
}

function rowViolations(row: InteractiveListRow, path: string): InteractiveLimitViolation[] {
  return [
    ...checkText({
      path: `${path}.id`,
      text: row.id,
      maxLength: WHATSAPP_CHOICE_LIMIT.LIST_ROW_ID_LENGTH,
      isRequired: true,
    }),
    ...checkText({
      path: `${path}.title`,
      text: row.title,
      maxLength: WHATSAPP_CHOICE_LIMIT.LIST_ROW_TITLE_LENGTH,
      isRequired: true,
    }),
    ...checkText({
      path: `${path}.description`,
      text: row.description,
      maxLength: WHATSAPP_CHOICE_LIMIT.LIST_ROW_DESCRIPTION_LENGTH,
      isRequired: false,
    }),
  ]
}

function listViolations(message: InteractiveListMessage): InteractiveLimitViolation[] {
  const hasManySections = message.sections.length > 1
  const sectionViolations = message.sections.flatMap((section, sectionIndex) => [
    ...checkText({
      path: `sections[${sectionIndex}].title`,
      text: section.title,
      maxLength: WHATSAPP_CHOICE_LIMIT.LIST_SECTION_TITLE_LENGTH,
      isRequired: hasManySections,
    }),
    ...(section.rows.length === 0
      ? [{ path: `sections[${sectionIndex}].rows`, rule: 'min-count' as const, limit: 1, actual: 0 }]
      : []),
    ...section.rows.flatMap((row, rowIndex) => rowViolations(row, `sections[${sectionIndex}].rows[${rowIndex}]`)),
  ])
  const rows = message.sections.flatMap((section, sectionIndex) =>
    section.rows.map((row, rowIndex) => ({ path: `sections[${sectionIndex}].rows[${rowIndex}].id`, id: row.id })),
  )
  return [
    ...checkText({
      path: 'buttonLabel',
      text: message.buttonLabel,
      maxLength: WHATSAPP_CHOICE_LIMIT.LIST_BUTTON_LABEL_LENGTH,
      isRequired: true,
    }),
    ...checkCount('sections', message.sections.length, WHATSAPP_CHOICE_LIMIT.LIST_SECTIONS),
    ...(message.sections.length > 0 ? checkCount('rows', rows.length, WHATSAPP_CHOICE_LIMIT.LIST_ROWS) : []),
    ...sectionViolations,
    ...checkDuplicateIds(rows),
  ]
}

/**
 * Todas as regras da Meta que a mensagem viola, de uma vez — quem edita o texto corrige tudo numa
 * passada só. Lista vazia = a Graph API aceita a forma da mensagem.
 */
export function listInteractiveLimitViolations(message: InteractiveMessage): readonly InteractiveLimitViolation[] {
  const bodyViolations = checkText({
    path: 'body',
    text: message.body,
    maxLength: WHATSAPP_CHOICE_LIMIT.BODY_LENGTH,
    isRequired: true,
  })
  return [...bodyViolations, ...(message.kind === 'buttons' ? buttonsViolations(message) : listViolations(message))]
}

/**
 * Falha cedo, antes da rede: passar de um teto não degrada a mensagem, a Graph API recusa a mensagem
 * inteira e o cliente vê silêncio.
 */
export function assertInteractiveWithinLimits(message: InteractiveMessage): void {
  const violations = listInteractiveLimitViolations(message)
  if (violations.length > 0) throw new InteractiveLimitExceededError(violations)
}
