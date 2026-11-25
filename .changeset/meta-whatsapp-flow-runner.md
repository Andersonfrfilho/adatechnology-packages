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
- **module**: `FlowInterpreter` stores `answerValue` (converted answer), treats an action node without
  `actionKind` as a message node that follows `next`, and accepts `onNodeEntered`/`enterInitialNode`.
- **module**: `features.previewContacts` answers numbers starting with `0` with `preview.<uuid>`
  without calling Meta; `webhook.buildPreviewPayload(command)` stamps the module `phone_number_id`.
- **contracts**: `flowNodeDataSchema` gains `validation`, `skipKeywords`, `maxInvalidAnswers`,
  `optionDetails`, `listButtonLabel`, `choiceProvider`, `next.byKeyword` and the `dynamic_choice`
  type; `validateFlowAnswer`, `parseFlowDate` (locale words, `minDate: 'today'`, `afterContextKey`),
  `parseFlowInteger`, `parseFlowMoney`, `parseFlowCpf`, `matchFlowChoice`, `matchFlowKeywordRoute`,
  `interpolateFlowText`, `isWithinBusinessHours`, `PREVIEW_CONTACT_PREFIX`, `DEFAULT_PREVIEW_CONTACT`,
  `isPreviewContact`, `FlowRunnerError`, `DynamicChoiceProvider`; `/testing` exports
  `PreviewInboundCommand` and `buildPreviewInboundPayload`.
- **conversations-ui**: node panel fields for validation, retries, fallback, skip words, keyword
  routes, option descriptions/sections, list button label and dynamic choice provider; palette entries
  for dynamic choice and message nodes; keyword routes drawn as card outputs; limits read from
  `WHATSAPP_CHOICE_LIMIT` with code point counting; WhatsApp preview shows sections and descriptions;
  simulator clients default `from` to `DEFAULT_PREVIEW_CONTACT`. An action node without `actionKind`
  now has an output (message node).
