---
'@adatechnology/fiscal-provider': minor
---

Emit `infRespTec` on the CT-e when a responsável técnico is configured

The CT-e 4.00 layout closes `infCte` with `infRespTec`, the group that identifies the
software house behind the emitting system — CNPJ, contact name, e-mail and phone. The
builder had no way to express it, so every CT-e went out without the group, and an
emitter that needs to declare its developer had nowhere to put the data.

`CteConfig.responsavelTecnico` is optional: leaving it undefined produces the exact XML
as before, without the group. When present, `<infRespTec>` is written as the last child
of `infCte`, right after `infCTeNorm`, matching the element order the SEFAZ authorizes.
CNPJ and phone are stripped to digits, the same normalization already applied to the
emitter's own fields.

Note that the responsável técnico is the developer of the emitting software, not the
carrier signing the document — the two are different legal entities.
