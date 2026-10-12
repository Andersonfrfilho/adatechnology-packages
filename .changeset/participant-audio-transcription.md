---
'@adatechnology/conversation-contracts': minor
---

Participant attachments gain two optional fields: `durationMs` (positive integer, up to 24 hours) and `transcription`, a discriminated union by `status` (`pending`, `ready`, `failed`, `disabled`). `ready` carries `text` (up to 40 000 UTF-16 units, empty means silence), an optional `language` hint, `engine` and `generatedAt`. Additive: messages without the new fields stay valid, and fields outside their branch are stripped. Unknown keys are stripped, but an invalid `transcription` or `durationMs` fails the attachment's schema, so hosts should validate per attachment (`participantTranscriptionSchema.safeParse`) and drop the field when it fails.
