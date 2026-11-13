import { describe, expect, it } from 'bun:test'

import { buildConversation } from './participantFixtures.test-helper'
import { resolveConversationIcon } from './participantSubjectIcon'

const conversation = buildConversation({ subjectId: '1' })
const group = { subjectType: 'invoice', label: 'Invoices', icon: <i>group</i> }

describe('resolveConversationIcon', () => {
  it('prefers the host icon, then the group icon, then nothing', () => {
    const host = <b>host</b>
    expect(resolveConversationIcon({ conversation, group, renderSubjectIcon: () => host })).toBe(host)
    expect(resolveConversationIcon({ conversation, group })).toBe(group.icon)
    expect(resolveConversationIcon({ conversation, group: { ...group, icon: undefined } })).toBeUndefined()
    expect(resolveConversationIcon({ conversation, group: undefined })).toBeUndefined()
  })

  it.each([null, undefined, false, ''])('treats %p from the host as no icon, like the list row', (empty) => {
    expect(resolveConversationIcon({ conversation, group, renderSubjectIcon: () => empty })).toBe(group.icon)
  })

  it('hands the conversation to the host renderer', () => {
    const seen: string[] = []
    resolveConversationIcon({ conversation, group, renderSubjectIcon: (item) => seen.push(item.subjectId) })
    expect(seen).toEqual(['1'])
  })
})
