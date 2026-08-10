---
'@adatechnology/meta-whatsapp-module': patch
---

Ignore webhook events addressed to another number of the same WABA

The Meta webhook subscription is per WABA, not per phone number: every app
subscribed to the account receives the events of every number it holds. The
receive use case never looked at `metadata.phone_number_id`, so an instance
sharing a WABA with another product answered that product's customers and wrote
their contacts into its own database. This happened in production, with a real
customer reaching the wrong bot.

`ReceiveWebhookUseCase` now takes the configured `phoneNumberId` and skips
changes addressed elsewhere. They are counted in the new `ignoredForeignNumber`
field of the result instead of being dropped silently — a filter that discards
without a trace is indistinguishable from a webhook that stopped arriving.
Events without `metadata` keep being processed: only Meta fills that field, and
there is no way to decide ownership without it.

`createMetaWhatsAppModule` already required `phoneNumberId` in its config, so no
consumer change is needed.
