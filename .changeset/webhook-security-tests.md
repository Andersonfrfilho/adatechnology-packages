---
'@adatechnology/meta-whatsapp-module': patch
---

Add a test suite for webhook signature verification and anti-replay

These assertions came from QuickCart, which kept its own signature tests until
the verification moved into this module. The code changed homes and the coverage
had to follow — this is what separates a genuine Meta delivery from a forged
call, and it was left covered only by the example script.

Covers: challenge verification (mode, token, empty-secret), HMAC over the raw
body (Buffer and string, wrong secret, tampered body, missing/malformed header),
and the anti-replay claim (first wins, replay denied, distinct deliveries
independent, namespaced key).
