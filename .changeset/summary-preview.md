---
'@adatechnology/meta-whatsapp-module': patch
---

Fill `lastContent`, `lastDirection` and `unread` in the conversation list

`ConversationSummary` declared these fields and `conversations-ui`'s
`ConversationListItem` renders them, but `listByContextFilters` never selected
them — `unread` was hardcoded to 0 with a note saying the host would compute it.
The result was an inbox with blank preview lines and every conversation showing
zero unread, which is what QuickCart hit on its first list call.

All three are the module's own data: the last message lives in its `messages`
table and `markRead` already writes `lastAgentReadAt`, so the read rule is the
module's too. Leaving them out forced every consumer to rewrite the same join
against tables it does not own.

Computed as correlated subqueries rather than a second round trip, since an
inbox lists dozens of conversations per page and one query per row is the
classic bottleneck for that screen.
