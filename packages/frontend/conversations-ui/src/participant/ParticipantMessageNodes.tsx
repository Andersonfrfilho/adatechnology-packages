import type { ReactNode } from 'react'

import { ParticipantCopyableToken, ParticipantLinkCopyButton } from './ParticipantCopyableToken'
import type { ParticipantConversationsLabels } from './participantLabels'
import type { InlineNode } from './participantMessageFormat.types'

export type ParticipantTextLabels = Pick<
  ParticipantConversationsLabels,
  'externalLinkHint' | 'copyValue' | 'valueCopied'
>

const LINK_REL = 'noopener noreferrer nofollow ugc'

function renderLink(
  node: Extract<InlineNode, { kind: 'link' }>,
  labels: ParticipantTextLabels,
  key: number,
): ReactNode {
  const isExternal = /^https?:/i.test(node.href)
  return (
    <span className="cv-p-text__link-group" key={key}>
      <a className="cv-p-text__link" href={node.href} rel={LINK_REL} target={isExternal ? '_blank' : undefined}>
        {node.label}
        {isExternal ? <span className="cv-p-sr-only"> ({labels.externalLinkHint})</span> : null}
      </a>
      <ParticipantLinkCopyButton value={node.href} labels={labels} />
    </span>
  )
}

export function renderInlineNodes(nodes: readonly InlineNode[], labels: ParticipantTextLabels): ReactNode[] {
  return nodes.map((node, key): ReactNode => {
    switch (node.kind) {
      case 'text':
        return node.value
      case 'strong':
        return <strong key={key}>{renderInlineNodes(node.children, labels)}</strong>
      case 'em':
        return <em key={key}>{renderInlineNodes(node.children, labels)}</em>
      case 'del':
        return <del key={key}>{renderInlineNodes(node.children, labels)}</del>
      case 'code':
        return (
          <code className="cv-p-text__code" key={key}>
            {node.value}
          </code>
        )
      case 'link':
        return renderLink(node, labels, key)
      case 'copyable':
        return <ParticipantCopyableToken key={key} copyKind={node.copyKind} value={node.value} labels={labels} />
    }
  })
}
