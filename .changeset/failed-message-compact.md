---
'@adatechnology/conversations-ui': minor
---

Participant view: a message that failed to send now looks like a normal bubble plus a retry button beside it (default markup and style change, only `.cv-p-*`).

- The failed bubble keeps the height of a normal one: text, then a meta line with the clock and the red failure icon (the short "Failed" text is screen-reader only while retry is offered). Its border is a mix of the danger color and the usual border, not a red box.
- Retry is a round red icon button outside the bubble, to its left (`cv-p-bubble-row--failed` wraps the bubble and the button), still per message. It has no visible text; its `aria-label` is `labels.statusFailed`. The 44px touch target comes from the button itself, not from the bubble. Without `onRetry` there is no button.
- Edit and Discard left the bubble. They live in a small menu opened from a `⋯` button in the meta line (`aria-haspopup="menu"`, `aria-expanded`; `role="menu"` / `menuitem`; arrows, Home/End, Escape returns focus to the trigger, Tab and outside click close it, no focus trap). Without `onEdit` and `onDiscard` there is no menu. Discard uses the danger color.
- New optional label `messageOptions` (default "Message options") names the `⋯` button. `labels.retry` is no longer rendered by the default view.
- Tooltips in the participant view: `ParticipantThread` (and so `ConversationThread`) now mounts the package `TooltipLayer`. It draws nothing at rest, and only one layer paints when a host already mounts another, so no double balloon. Icon-only controls carry `data-cv-tooltip` with their existing accessible label: back, copy protocol, copy link, attach, send, scroll to latest, remove attachment, retry, the `⋯` menu button, channel badges, and the status ticks of a bubble (when the status text is not already visible). No new labels and no native `title`. Tooltips show on hover and keyboard focus only; touch is unchanged.
- Golden fixtures: the failed pending message changed `thread-default`, `thread-avatars-initials`, `thread-tail-off` and `thread-closed`; the tooltip attributes also touch `thread-plain`, `thread-error` and `thread-loading`. In those the only difference at rest is the new `data-cv-tooltip` attributes. The conversation list goldens are unchanged.
