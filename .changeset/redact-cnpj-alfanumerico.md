---
'@adatechnology/logger': patch
---

Redact the alphanumeric CNPJ and the access key that carries it

The CNPJ became `[A-Z0-9]{12}[0-9]{2}` (IN RFB 2229/2024, NT Conjunta DF-e 2025.001, in production
since 01/07/2026), and the value-shape layer of `redact` was written when `\d` was the document's
whole alphabet. Three patterns stopped matching: the bare CNPJ, the punctuated CNPJ, and the 44
character access key — which is the worst of the three, because `chaveAcesso` is not on the key
denylist and the shape pattern is its only defence. An alphanumeric key was going to the log whole,
naming the issuer, in a line that looked perfectly normal.

The access key and the punctuated CNPJ widened by shape alone: `[0-9]{6}[A-Z0-9]{12}[0-9]{26}` and
letters inside the mask. Punctuation is evidence of intent, and nothing else in a log has that
shape.

The bare form could not widen the same way. Fourteen standalone characters with letters is the
shape of a CNPJ and also the shape of an opaque id, so the check digits decide: a match is redacted
only when module 11 closes. Without that, `01J8Z9ABCDEF12` becomes `[CNPJ_REDACTED]` and the log
stops diagnosing anything. The purely numeric form keeps the pattern it always had, with no check
digit — fourteen consecutive digits standing alone is already a document in practically every log,
and adding a check there would be a regression.

The module 11 is written into this package on purpose. It has no runtime dependencies, and its
consumers are chat, catalog and fiscal products alike; importing the fiscal package just to redact
a log line would drag `pdfkit`, `xml-crypto` and `node-forge` into all of them.
