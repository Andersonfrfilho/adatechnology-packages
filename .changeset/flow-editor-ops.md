---
'@adatechnology/conversations-ui': minor
---

Flow editor graph operations, extracted and tested (ADR 0002, step 1 of 3)

The pure graph operations the flow editor needs lived loose inside financiamento's 973-line
`FlowsBlueprintPage`. Three of them decide what happens to a flow someone drew, and their failure
mode is silent:

- `removeNodeAndCleanRefs` — an edge left pointing at a deleted node raises nothing in the editor. It
  stalls the conversation mid-flow, and the symptom reaches the customer, not the person who edited.
  Branch answers keep their key with an empty target rather than being dropped: removing the key would
  hide from the screen that the option exists and leads nowhere, and someone would publish it.
- `resolveConnection` — connecting to a node in *another* flow only works if it is that flow's start
  node, because the engine can only jump to a flow's beginning. Connecting to the middle is refused,
  which beats writing a jump the bot silently ignores in production.
- `mergedFlowKeysFrom` — BFS, not recursion: a menu that loops back to itself is the most ordinary
  case there is, and naive recursion would blow the stack on it.

Plus `isGraphDirty` (dragging a card counts as an edit — it publishes), `applyConnection` (branching a
single-exit node does *not* inherit the old target as the default, or the unconfigured branch would
keep going where the node used to go), and the namespaced-id helpers the merged canvas needs.

23 tests, verified by mutation on all three risk functions. Types come from
`meta-whatsapp-contracts` with no casts, so the fixtures break if the contract shape changes — which
is the drift `flowGraph.ts` documents having happened before with `FlowGraphData.version`.

`FlowsWorkspace` itself is **not** in this release. It is an editor state machine, not a layout
wrapper, and the only host that exercises editing is financiamento — see ADR 0002 for why the shell
waits for a pass with that app running.
