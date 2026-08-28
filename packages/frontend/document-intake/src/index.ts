/* Copyright (c) 2026 Ada Technology. MIT License. */

/**
 * Leitura de documento brasileiro a partir da camada de texto de um PDF, no navegador de quem
 * enviou o arquivo — sem requisição, sem origem nova na CSP e sem nada gravado.
 *
 * O carregador do pdf.js **não** mora aqui, de propósito: ele é cola do bundler do app
 * (`import('pdfjs-dist/build/pdf.worker.min.mjs?url')` é sintaxe do Vite), e é o app que precisa
 * emitir o worker na própria origem para satisfazer o `worker-src 'self'` da CSP dele. `readPdfTextLayer`
 * recebe `getDocument` por parâmetro, o que também é o que mantém esta camada testável fora do navegador.
 */
export { readPdfTextLayer } from './pdfTextLayer.service'
export type { PdfGetDocument, PdfPageText, PdfTextFragment } from './pdfTextLayer.service'

export { findLabelFragment, normalizeLabel, readValueBelowLabel } from './labelGeometry.service'

export { DOCUMENT_KIND, identifyDocumentKind } from './documentKind.service'
export type { DocumentKind } from './documentKind.service'

export {
  BRAZILIAN_STATES,
  isValidChassis,
  isValidCnpj,
  isValidCpf,
  isValidPlate,
  isValidRenavam,
  isValidState,
} from './checkDigit.service'

export { readCcmei } from './ccmei.service'
export type { CcmeiAddress, CcmeiReading, CcmeiRemark, CcmeiRemarkReason, CcmeiValues } from './ccmei.service'
