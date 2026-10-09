---
'@adatechnology/conversations-ui': minor
---

Participant view: a message that failed to send is now compact (default markup and style change, only `.cv-p-*`).

- The bordered 44px retry button inside the meta line is gone. The meta line keeps the clock and the red failure icon (the short "Failed" text is screen-reader only while retry is offered).
- Retry, Edit and Discard are now plain text actions in one row under the message, retry first. The retry visible label is `labels.retry` (default "Retry"); the long `labels.statusFailed` text moved to its `aria-label`.
- Retry stays per message. `FailedActions` takes the new optional `onRetry`. Retry and Discard use the danger color, Edit the muted one; touch target stays 44px through the row height.
- Golden fixtures that contain a failed pending message (`thread-default`, `thread-avatars-initials`, `thread-tail-off`, `thread-closed`) were regenerated; every other golden is unchanged.
