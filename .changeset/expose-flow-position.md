---
'@adatechnology/meta-whatsapp-contracts': patch
'@adatechnology/meta-whatsapp-module': patch
---

Expose the conversation's flow position on `ConversationSession`

The schema stores `flow_key` and `current_node_id` and `setFlowPosition` writes
them, but the session contract never exposed either. Since the module only
interprets the graph and the *host* drives it, the host had no supported way to
learn where a conversation had stopped — it would have had to query the module's
own table directly, around the contract it was given.

QuickCart hit this the moment it tried to resume a conversation mid-flow.
