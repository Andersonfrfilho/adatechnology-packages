/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * AST → HTML com TODO texto e atributo escapados. Não há caminho para HTML do autor chegar cru à
 * saída: o AST não tem nó de HTML, e as URLs já chegam saneadas pelo parser. Serve feed, e-mail e
 * renderização no servidor; no navegador, o `content-ui` monta elementos React a partir do mesmo
 * AST e nem usa string.
 */

import { createHeadingIdGenerator } from './headingIds'
import type { MarkdownBlock, MarkdownDocument, MarkdownInline } from './markdown.types'
import { parseMarkdown } from './parseMarkdown'
import { inlineToPlainText } from './plainText'
import { isAbsoluteHttpUrl } from './sanitizeUrl'

export type MarkdownRenderOptions = {
  /** Soma ao nível do título: com 1, `#` vira `<h2>` (a página já tem o `<h1>` do post). */
  readonly headingLevelOffset?: number
  /** Âncora nos títulos. Padrão: `true`. */
  readonly headingIds?: boolean
  readonly headingIdPrefix?: string
  /** Link absoluto abre em nova aba. Padrão: `true`. */
  readonly externalLinksInNewTab?: boolean
  /** Padrão `noopener noreferrer`; o host pode acrescentar `nofollow ugc`. */
  readonly linkRel?: string
}

export const DEFAULT_LINK_REL = 'noopener noreferrer'

const ESCAPES: Readonly<Record<string, string>> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ESCAPES[character] ?? character)
}

export function resolveHeadingLevel(level: number, offset = 0): 1 | 2 | 3 | 4 | 5 | 6 {
  return Math.min(6, Math.max(1, level + offset)) as 1 | 2 | 3 | 4 | 5 | 6
}

type RenderContext = {
  readonly options: MarkdownRenderOptions
  readonly nextHeadingId: (text: string) => string
}

function renderInline(nodes: readonly MarkdownInline[], context: RenderContext): string {
  return nodes.map((node) => renderInlineNode(node, context)).join('')
}

function renderInlineNode(node: MarkdownInline, context: RenderContext): string {
  switch (node.type) {
    case 'text':
      return escapeHtml(node.value)
    case 'strong':
      return `<strong>${renderInline(node.children, context)}</strong>`
    case 'emphasis':
      return `<em>${renderInline(node.children, context)}</em>`
    case 'strikethrough':
      return `<del>${renderInline(node.children, context)}</del>`
    case 'inlineCode':
      return `<code>${escapeHtml(node.value)}</code>`
    case 'break':
      return '<br>'
    case 'image': {
      const title = node.title ? ` title="${escapeHtml(node.title)}"` : ''
      return `<img src="${escapeHtml(node.src)}" alt="${escapeHtml(node.alt)}"${title} loading="lazy" decoding="async">`
    }
    case 'link': {
      const title = node.title ? ` title="${escapeHtml(node.title)}"` : ''
      const newTab = (context.options.externalLinksInNewTab ?? true) && isAbsoluteHttpUrl(node.href)
      const target = newTab ? ' target="_blank"' : ''
      const rel = escapeHtml(context.options.linkRel ?? DEFAULT_LINK_REL)
      return `<a href="${escapeHtml(node.href)}"${title}${target} rel="${rel}">${renderInline(node.children, context)}</a>`
    }
  }
}

function renderBlock(block: MarkdownBlock, context: RenderContext, tight = false): string {
  switch (block.type) {
    case 'heading': {
      const level = resolveHeadingLevel(block.level, context.options.headingLevelOffset)
      const id =
        (context.options.headingIds ?? true)
          ? ` id="${escapeHtml(context.nextHeadingId(inlineToPlainText(block.children)))}"`
          : ''
      return `<h${level}${id}>${renderInline(block.children, context)}</h${level}>`
    }
    case 'paragraph':
      return tight ? renderInline(block.children, context) : `<p>${renderInline(block.children, context)}</p>`
    case 'blockquote':
      return `<blockquote>${block.children.map((child) => renderBlock(child, context)).join('')}</blockquote>`
    case 'codeBlock': {
      const className = block.language ? ` class="language-${escapeHtml(block.language)}"` : ''
      return `<pre><code${className}>${escapeHtml(block.value)}</code></pre>`
    }
    case 'thematicBreak':
      return '<hr>'
    case 'list': {
      const tag = block.ordered ? 'ol' : 'ul'
      const start = block.ordered && block.start !== undefined && block.start !== 1 ? ` start="${block.start}"` : ''
      const items = block.items
        .map((item) => `<li>${item.map((child) => renderBlock(child, context, block.tight)).join('')}</li>`)
        .join('')
      return `<${tag}${start}>${items}</${tag}>`
    }
  }
}

export function renderMarkdownDocument(document: MarkdownDocument, options: MarkdownRenderOptions = {}): string {
  const context: RenderContext = { options, nextHeadingId: createHeadingIdGenerator(options.headingIdPrefix) }
  return document.children.map((block) => renderBlock(block, context)).join('\n')
}

/** Markdown do autor → HTML seguro para injetar como está (feed, e-mail, SSR). */
export function renderMarkdownToHtml(markdown: string, options: MarkdownRenderOptions = {}): string {
  return renderMarkdownDocument(parseMarkdown(markdown), options)
}
