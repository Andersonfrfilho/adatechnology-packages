/* Copyright (c) 2026 Ada Technology. MIT License. */

import { normalizeLabel } from './labelGeometry.service'
import type { PdfPageText } from './pdfTextLayer.service'

/**
 * Spec 048: **a identificação é pelo título, nunca pela palavra solta.** Medido: o CRLV contém a
 * palavra "CNH" no rodapé promocional da Carteira Digital de Trânsito. Um classificador
 * "contém CNH → é CNH" chama todo CRLV de habilitação, e o operador só descobre quando o formulário
 * de motorista abre com dado de veículo.
 *
 * CNH e ANTT continuam fora: a spec tem `[NEEDS CLARIFICATION]` para as duas, e mapa de campo
 * escrito sem amostra é adivinhação com aparência de código.
 */
export const DOCUMENT_KIND = ['ccmei', 'crlv', 'scanned', 'unknown'] as const
export type DocumentKind = (typeof DOCUMENT_KIND)[number]

const CRLV_TITLE = 'CERTIFICADO DE REGISTRO E LICENCIAMENTO DE VEICULO'
const CCMEI_TITLE = 'CERTIFICADO DA CONDICAO DE MICROEMPREENDEDOR INDIVIDUAL'

/** O título é impresso no cabeçalho; procurá-lo na folha inteira é voltar à palavra solta. */
const TITLE_BAND_RATIO = 0.7

/**
 * O título do CCMEI é impresso em **duas linhas** — conferido numa amostra real —, então casá-lo
 * dentro de um fragmento só não reconheceria documento nenhum. Juntar linhas vizinhas resolve isso
 * sem afrouxar a regra: o limite é a altura da própria fonte, e duas linhas afastadas continuam
 * sendo duas frases que por acaso se somam, nunca um título.
 */
const TITLE_LINE_GAP_RATIO = 3

/** Cada linha da faixa sozinha, mais cada par de linhas vizinhas — nessa ordem, de cima para baixo. */
function titleCandidates(fragments: readonly PdfPageText['fragments'][number][]): readonly string[] {
  const ordered = [...fragments].sort((first, second) => second.y - first.y)
  const candidates: string[] = []

  for (let index = 0; index < ordered.length; index += 1) {
    const current = ordered[index]
    if (current === undefined) continue
    candidates.push(normalizeLabel(current.text))

    const next = ordered[index + 1]
    if (next !== undefined && current.y - next.y <= current.height * TITLE_LINE_GAP_RATIO) {
      candidates.push(normalizeLabel(`${current.text} ${next.text}`))
    }
  }

  return candidates
}

export function identifyDocumentKind(page: PdfPageText): DocumentKind {
  if (page.fragments.length === 0) return 'scanned'

  const titleFloor = page.height * TITLE_BAND_RATIO
  const candidates = titleCandidates(page.fragments.filter((fragment) => fragment.y >= titleFloor))

  if (candidates.some((candidate) => candidate.includes(CRLV_TITLE))) return 'crlv'
  if (candidates.some((candidate) => candidate.includes(CCMEI_TITLE))) return 'ccmei'
  return 'unknown'
}
