---
'@adatechnology/conversations-ui': minor
---

Participant view: a message that failed to send now looks like a normal bubble plus a retry button beside it (default markup and style change, only `.cv-p-*`).

- The failed bubble keeps the height of a normal one: text, then a meta line with the clock and the red failure icon (the short "Failed" text is screen-reader only while retry is offered). Its border is a mix of the danger color and the usual border, not a red box.
- Retry is a round red icon button outside the bubble, to its left (`cv-p-bubble-row--failed` wraps the bubble and the button), still per message. It has no visible text; its `aria-label` is `labels.statusFailed`. The 44px touch target comes from the button itself, not from the bubble. Without `onRetry` there is no button.
- Edit and Discard left the bubble. They live in a small menu opened from a `⋯` button in the meta line (`aria-haspopup="menu"`, `aria-expanded`; `role="menu"` / `menuitem`; arrows, Home/End, Escape returns focus to the trigger, Tab and outside click close it, no focus trap). Without `onEdit` and `onDiscard` there is no menu. Discard uses the danger color.
- New optional label `messageOptions` (default "Message options") names the `⋯` button. `labels.retry` is no longer rendered by the default view.
- Golden fixtures that contain a failed pending message (`thread-default`, `thread-avatars-initials`, `thread-tail-off`, `thread-closed`) were regenerated; every other golden is unchanged.
