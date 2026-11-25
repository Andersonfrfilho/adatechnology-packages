/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import type { MarkdownBlock, MarkdownDocument, MarkdownInline } from './markdown.types'
import { parseMarkdown } from './parseMarkdown'

export function inlineToPlainText(nodes: readonly MarkdownInline[]): string {
  return nodes
    .map((node) => {
      switch (node.type) {
        case 'text':
        case 'inlineCode':
          return node.value
        case 'image':
          return node.alt
        case 'break':
          return '\n'
        default:
          return inlineToPlainText(node.children)
      }
    })
    .join('')
}

function blockToPlainText(block: MarkdownBlock): string {
  switch (block.type) {
    case 'heading':
    case 'paragraph':
      return inlineToPlainText(block.children)
    case 'codeBlock':
      return block.value
    case 'blockquote':
      return block.children.map(blockToPlainText).join('\n\n')
    case 'list':
      return block.items.map((item) => item.map(blockToPlainText).join('\n')).join('\n')
    case 'thematicBreak':
      return ''
  }
}

export function documentToPlainText(document: MarkdownDocument): string {
  return document.children
    .map(blockToPlainText)
    .filter((text) => text.length > 0)
    .join('\n\n')
}

/** Texto corrido do Markdown, sem marcação: base do tempo de leitura, do resumo e do feed. */
export function markdownToPlainText(markdown: string): string {
  return documentToPlainText(parseMarkdown(markdown))
}
