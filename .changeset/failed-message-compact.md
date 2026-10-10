---
'@adatechnology/conversations-ui': minor
---

Participant view: a message that failed to send now looks like a normal bubble with a retry button beside it, and the view gets tooltips. Default markup and style change, only `.cv-p-*`; one fix lands in the shared tooltip core.

**Failed message**

- The failed bubble has the same height and the same 85% width cap as a normal one (measured in a real browser: 91px both, same width). Its border mixes the danger color with the usual border instead of a red box. The meta line keeps the clock and the red failure icon; the short "Failed" text is screen-reader only while retry is offered.
- Retry is a round red icon button hung outside the bubble, to its left (`cv-p-failed-retry`, first child of the bubble, absolutely positioned, so the bubble keeps its flow and is not wrapped in a row). Still per message, 44px target, no visible text. Its `aria-label` is `labels.statusFailed` and `aria-describedby` points to the message text. Without `onRetry` there is no button.
- Edit and Discard left the bubble. They live in a small menu opened from a `⋯` button in the meta line (`aria-haspopup="menu"`, `aria-expanded`, `role="menu"` labelled by the button, `menuitem`s; arrows, Home/End, Escape returns focus to the button and does not reach a host dialog, Tab and outside click close it, no focus trap). The menu opens above the bubble and flips below (`cv-p-failed-menu__list--below`) when the thread scroller would clip it. Without `onEdit` and `onDiscard` there is no menu. Discard uses the danger color. The `⋯` hit area stays inside the bubble padding, so it is smaller than 44px.
- Removed classes: `.cv-p-bubble__retry`, `.cv-p-bubble__action`, `.cv-p-bubble__actions`. `FailedActions` is gone and `labels.retry` is no longer rendered (marked `@deprecated`).
- New optional label `messageOptions` (default "Message options") names the `⋯` button. Translated hosts must fill it, or that button is announced in English.
- Remounting: the bubble content is the same element when a message goes from failed to sent, so it is not remounted.

**Tooltips**

- `ParticipantThread` (and so `ConversationThread`) mounts the package `TooltipLayer`; it draws nothing at rest. Icon-only controls carry `data-cv-tooltip` with their existing accessible label: back, copy protocol, copy link, attach, send, scroll to latest, remove attachment, retry, the `⋯` button (not while its menu is open), channel badges (including the ones in the inbox list row, inert there unless a layer is mounted) and the status ticks of a bubble when the status text is not already visible. No new labels and no native `title`.
- On touch, the participant view stops `pointerover` and the `focusin` that follows a touch at the thread root, so a tap that focuses a button on Android does not leave a balloon on. Keyboard focus and mouse hover are unchanged. The core behavior for the other flows is untouched.
- Core fix (no markup change): when the `TooltipLayer` that owns the document listeners unmounts, ownership now passes to the next mounted layer (a registry in `tooltipLayerRegistry.ts`). Before, the other layers stayed without tooltips. Still one balloon at a time.

**Golden fixtures**

The failed pending message changed `thread-default`, `thread-avatars-initials`, `thread-tail-off` and `thread-closed`; the tooltip attributes also touch `thread-plain`, `thread-error` and `thread-loading` (only `data-cv-tooltip` attributes there). The conversation list goldens are unchanged.
