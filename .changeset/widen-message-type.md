---
'@adatechnology/meta-whatsapp-module': patch
---

Widen `messages.type` from varchar(16) to varchar(32)

Meta's own message types are short ('text', 'audio', 'interactive'), but a host
labels outbound rows with the subtype it actually sent — 'interactive_buttons'
is already 19 characters. QuickCart hit this on its first real conversation:
the engine sent an interactive reply and the insert failed with "value too long
for type character varying(16)", silently, because the send path is
fire-and-forget.

Keeping 16 would have pushed every consumer into choosing between truncating a
meaningful label and blowing up the insert.
