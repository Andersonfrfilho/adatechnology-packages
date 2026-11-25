---
'@adatechnology/meta-whatsapp-contracts': minor
'@adatechnology/meta-whatsapp-module': minor
'@adatechnology/conversations-ui': minor
---

meta-whatsapp: module-side flow runner, answer validation, keyword routing, handoff with business hours, dynamic choices and preview contacts

- **module**: `features.flowRunner` (off by default) makes the inbound dispatcher drive the published
  graph after `onMessageReceived` returns `'continue'`: renders questions, buttons (≤3 plain options)
  or lists (descriptions, sections) with a numbered-text fallback, validates answers, retries with
  `fallbackMessage` and hands off after `maxInvalidAnswers` (default 2), interpolates `{{key}}`, sends
  `directMessage` on entering a node, follows `flow:` jumps and saves position and context in one
  write (`SessionRepository.saveFlowProgress`). Global keywords (`restart`, `handoff`, `flow:<key>`),
  `next.byKeyword` routing, `dynamic_choice` nodes with `registerDynamicChoiceProvider` and paging,
  `flows.runner.start()`, and the `onFlowRunnerError` hook.
- **module**: built-in `handoff` action (`requestHuman` + message by business hours, configurable per
  node through `actionParams.message` / `actionParams.outOfHoursMessage`).
- **module — BREAKING (behaviour)**: an action node without `actionKind` is now a message node that
  follows `next` instead of ending the flow (`FlowInterpreter`, and the editor draws an output for
  it). Graphs that relied on such a node to stop must give it no `next` or an explicit end.
- **module**: `FlowInterpreter` stores `answerValue` (converted answer) and accepts
  `onNodeEntered`/`enterInitialNode`.
- **module**: runner guarantees — one turn per conversation (`providers.flowTurnLock`, default
  `PostgresAdvisoryFlowTurnLock` with `pg_advisory_xact_lock`), at most once per inbound message
  (`__flow.lastInboundId` written before any send; redelivery returns `'duplicate'`; errors after that
  write go to `onFlowRunnerError` and are never rethrown), required `timeZone` (or derived from fixed
  `handoff.businessHours`), host variables win over customer answers in `{{key}}`,
  `unmatchedChoice: 'reask' | 'default'` (config or node; `'reask'` by default only under the runner),
  non-text answers re-asked without counting, template quick-reply buttons read by text, missing
  saved flow reset to the start flow, numbered-text fallback capped at 4096 characters, handoff
  tolerant to queue/hook failures.
- **module**: `features.previewContacts` answers numbers starting with `0` with `preview.<uuid>`
  without calling Meta; `webhook.buildPreviewPayload(command)` stamps the module `phone_number_id`.
- **contracts**: `flowNodeDataSchema` gains `validation`, `skipKeywords`, `maxInvalidAnswers`,
  `optionDetails`, `listButtonLabel`, `choiceProvider`, `next.byKeyword` and the `dynamic_choice`
  type; `validateFlowAnswer`, `parseFlowDate` (locale words, `minDate: 'today'`, `afterContextKey`),
  `parseFlowInteger`, `parseFlowMoney`, `parseFlowCpf`, `matchFlowChoice`, `matchFlowKeywordRoute`,
  `interpolateFlowText`, `isWithinBusinessHours`, `PREVIEW_CONTACT_PREFIX`, `DEFAULT_PREVIEW_CONTACT`,
  `isPreviewContact`, `FlowRunnerError`, `DynamicChoiceProvider`, `unmatchedChoice`,
  `WHATSAPP_CHOICE_LIMIT.TEXT_BODY_LENGTH`, template `button` in `whatsAppMessageSchema`, business
  hours windows crossing midnight; `/testing` exports
  `PreviewInboundCommand` and `buildPreviewInboundPayload`.
- **conversations-ui**: node panel fields for validation, retries, fallback, skip words, keyword
  routes, option descriptions/sections, list button label and dynamic choice provider; palette entries
  for dynamic choice and message nodes; keyword routes drawn as card outputs; limits read from
  `WHATSAPP_CHOICE_LIMIT` with code point counting; WhatsApp preview shows sections and descriptions;
  simulator clients keep `from` required and unchanged (pass `from: DEFAULT_PREVIEW_CONTACT` together
  with the server's `features.previewContacts` to opt in); `legend.dynamic_choice` is optional with a
  default label; "Resposta fora das opções" field and
  a warning when a choice node's `default` would be ignored. BREAKING (behaviour): an action node
  without `actionKind` now has an output (message node).
