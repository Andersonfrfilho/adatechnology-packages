---
'@adatechnology/conversations-ui': minor
---

Message menu as in common chat apps (opt-in `messageMenu`): a discreet chevron on the bubble, a right-click or a long press opens Copy, Select messages and Message info plus the host's entries; selection mode puts a check box beside each message and a bar that copies them with date, time and author, and runs the host's actions on all of them. Message info shows the author, when it was sent and, for this side's messages, the delivery state and read time. The thread header gains a menu to select messages and to download the loaded conversation as text. `ParticipantMessageActionsTarget` gains `createdAt`, `status` and `readAt`.
