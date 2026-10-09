import type { InlineNode } from './participantMessageFormat.types'

/** Compact notation to make the case tables readable: s=strong, e=em, d=del, c=code, l=link, t=text. */
export function show(nodes: readonly InlineNode[]): string {
  return nodes.map(showNode).join('')
}

function showNode(node: InlineNode): string {
  switch (node.kind) {
    case 'text':
      return node.value
    case 'code':
      return `⟦c:${node.value}⟧`
    case 'copyable':
      return `⟦k:${node.copyKind}:${node.value}⟧`
    case 'link':
      return `⟦l:${node.label}→${node.href}⟧`
    default:
      return `⟦${node.kind[0]}:${show(node.children)}⟧`
  }
}
