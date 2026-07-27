---
'@adatechnology/meta-whatsapp-contracts': patch
'@adatechnology/meta-whatsapp-module': patch
'@adatechnology/conversations-ui': patch
---

Make the flow node, the session context and the media strings product-agnostic

Three places still assumed a specific product, which blocked adopting the SDK as
the standard instead of keeping a parallel implementation in the host.

`FlowNodeData.simulationTemplate` named a financing concept inside the contract
and was read by no package. It is replaced by `actionKind` + `actionParams`: the
node carries arbitrary parameters for the handler the host registered, and the
package never interprets them. `flowNodeDataSchema` passes unknown keys through,
so graphs already stored keep loading during the transition.

`SessionRepository` could only replace the whole `context` object, so a host
accumulating answers across a conversation had to read-modify-write — and two
messages from the same customer processed in parallel would overwrite each
other. `patchContext` now merges in Postgres (`||`), and `setState`,
`patchContext` and the new `readContext` are generic over the host's own context
type.

`MediaRenderer` hardcoded seven Portuguese strings ("Carregando...", "Erro",
"Baixar", …), which no consumer could translate. They are now keys on
`ConversationLocales.bubble`, defaulting to the same text.

`FlowInterpreter` also gains its first test file, covering the shapes a host
needs to migrate an external automation workflow onto the interpreter:
conditions, host-service actions that merge results back into the context or
branch on their own, question capture, menu routing, cross-flow jumps and the
`maxSteps` cycle guard.
