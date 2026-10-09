import { useMemo } from 'react'

import { renderInlineNodes, type ParticipantTextLabels } from './ParticipantMessageNodes'
import { parseParticipantMessage } from './participantMessageFormat'
import type { FormatBlock } from './participantMessageFormat.types'

export type ParticipantMessageTextProps = {
  readonly text: string | null | undefined
  readonly labels: ParticipantTextLabels
}

function renderBlock(block: FormatBlock, labels: ParticipantTextLabels, key: number) {
  if (block.kind === 'paragraph') return <span key={key}>{renderInlineNodes(block.children, labels)}</span>
  if (block.kind === 'pre') {
    return (
      <pre className="cv-p-text__pre" key={key}>
        <code>{block.value}</code>
      </pre>
    )
  }
  if (block.kind === 'quote') {
    return (
      <blockquote className="cv-p-text__quote" key={key}>
        {renderInlineNodes(block.children, labels)}
      </blockquote>
    )
  }
  const items = block.items.map((item, index) => <li key={index}>{renderInlineNodes(item, labels)}</li>)
  if (block.ordered) {
    return (
      <ol className="cv-p-text__list" key={key} start={block.start === 1 ? undefined : block.start}>
        {items}
      </ol>
    )
  }
  return (
    <ul className="cv-p-text__list" key={key}>
      {items}
    </ul>
  )
}

export function ParticipantMessageText({ text, labels }: ParticipantMessageTextProps) {
  const blocks = useMemo(() => parseParticipantMessage(text), [text])
  if (blocks.length === 0) return null
  const [only] = blocks
  const children =
    blocks.length === 1 && only?.kind === 'paragraph'
      ? renderInlineNodes(only.children, labels)
      : blocks.map((block, key) => renderBlock(block, labels, key))
  return <div className="cv-p-text">{children}</div>
}
