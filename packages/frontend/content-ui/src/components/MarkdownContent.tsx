/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Renderiza o AST do `content-contracts` como elementos React — sem `dangerouslySetInnerHTML`.
 * O texto entra como filho de elemento, que o React escapa; as URLs já vêm saneadas do parser.
 */

import {
  createHeadingIdGenerator,
  DEFAULT_LINK_REL,
  inlineToPlainText,
  isAbsoluteHttpUrl,
  parseMarkdown,
  resolveHeadingLevel,
  type MarkdownBlock,
  type MarkdownInline,
} from '@adatechnology/content-contracts'
import { useMemo, type ReactNode } from 'react'

export type MarkdownContentProps = {
  readonly markdown: string
  /** Com 1, `#` vira `<h2>` — a página do post já tem o `<h1>`. */
  readonly headingLevelOffset?: number
  readonly className?: string
}

type RenderContext = { readonly offset: number; readonly nextHeadingId: (text: string) => string }

function renderInline(nodes: readonly MarkdownInline[]): ReactNode[] {
  return nodes.map((node, index) => {
    switch (node.type) {
      case 'text':
        return node.value
      case 'strong':
        return <strong key={index}>{renderInline(node.children)}</strong>
      case 'emphasis':
        return <em key={index}>{renderInline(node.children)}</em>
      case 'strikethrough':
        return <del key={index}>{renderInline(node.children)}</del>
      case 'inlineCode':
        return <code key={index}>{node.value}</code>
      case 'break':
        return <br key={index} />
      case 'image':
        return <img key={index} src={node.src} alt={node.alt} title={node.title} loading="lazy" decoding="async" />
      case 'link':
        return (
          <a
            key={index}
            href={node.href}
            title={node.title}
            rel={DEFAULT_LINK_REL}
            {...(isAbsoluteHttpUrl(node.href) ? { target: '_blank' } : {})}
          >
            {renderInline(node.children)}
          </a>
        )
    }
  })
}

function renderBlock(block: MarkdownBlock, key: number, context: RenderContext, tight = false): ReactNode {
  switch (block.type) {
    case 'heading': {
      const Tag = `h${resolveHeadingLevel(block.level, context.offset)}` as const
      return (
        <Tag key={key} id={context.nextHeadingId(inlineToPlainText(block.children))}>
          {renderInline(block.children)}
        </Tag>
      )
    }
    case 'paragraph':
      return tight ? (
        <span key={key}>{renderInline(block.children)}</span>
      ) : (
        <p key={key}>{renderInline(block.children)}</p>
      )
    case 'blockquote':
      return (
        <blockquote key={key}>{block.children.map((child, index) => renderBlock(child, index, context))}</blockquote>
      )
    case 'codeBlock':
      return (
        <pre key={key}>
          <code className={block.language ? `language-${block.language}` : undefined}>{block.value}</code>
        </pre>
      )
    case 'thematicBreak':
      return <hr key={key} />
    case 'list': {
      const items = block.items.map((item, index) => (
        <li key={index}>{item.map((child, childIndex) => renderBlock(child, childIndex, context, block.tight))}</li>
      ))
      return block.ordered ? (
        <ol key={key} start={block.start}>
          {items}
        </ol>
      ) : (
        <ul key={key}>{items}</ul>
      )
    }
  }
}

export function MarkdownContent({ markdown, headingLevelOffset = 0, className }: MarkdownContentProps) {
  const document = useMemo(() => parseMarkdown(markdown), [markdown])
  const context: RenderContext = { offset: headingLevelOffset, nextHeadingId: createHeadingIdGenerator() }
  return (
    <div className={['adc-prose', className].filter(Boolean).join(' ')}>
      {document.children.map((block, index) => renderBlock(block, index, context))}
    </div>
  )
}
