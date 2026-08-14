---
'@adatechnology/fiscal-provider': minor
---

Accept the alphanumeric CNPJ across every fiscal document, log and printed receipt

The CNPJ became `[A-Z0-9]{12}[0-9]{2}` under IN RFB 2229/2024 and NT Conjunta DF-e 2025.001,
in production since 01/07/2026. This package normalized taxpayer identifiers with
`replace(/\D/g, '')` in every builder, importer, filter, mask and print formatter — around
twenty sites. That call fails silently: the letters vanish and the remaining characters shift
left, producing a nine-position value that names a different taxpayer. Two distinct
alphanumeric CNPJs can collapse onto the same string, which is how a distribution filter would
return somebody else's note.

`src/sefaz/SefazTaxId.ts` is now the single source of truth: `CNPJ_PATTERN`, `CHAVE_PATTERN`,
`normalizeTaxId` (strips the `. / -` mask and uppercases, never removes unknown characters),
`calcularDvCnpj`, `calcularDvChave`, `isCnpjValid` and `formatCnpjForDisplay`. The check digit
uses `charCodeAt(0) - 48` as the character value, which is what makes every existing numeric
CNPJ compute exactly as it always did — the numeric golden XML for NF-e, NFC-e, CT-e and MDF-e
is byte-for-byte unchanged.

Callers that used to strip non-digits now normalize and **validate**, so an identifier that is
not a CNPJ raises instead of being silently truncated. The access key follows the same rule:
positions 6..19 carry the alphanumeric CNPJ and the cDV weights them by character value.

Two defects were the reason this could not wait. In `LogObfuscator`, the
`(<CNPJ>)(\d{14})(</CNPJ>)` group did not match an alphanumeric CNPJ, so the tag passed through
untouched and the document was written to the structured log in the clear, next to a correctly
masked `<xNome>`. In the printed receipts (`DanfceBuilder`, `controlid-cupom`, `CupomPdfBuilder`)
three separate copies of the same formatter — two with no length guard at all — printed
`12.345.013/5-` for `12ABC34501DE35`. On paper, a truncated document is indistinguishable from a
real one. The three copies are now one guarded function.

CPF is untouched: it remains eleven numeric digits, and it is the length that discriminates the
two, not the presence of a letter. Fields that are genuinely digits-only — CEP, telefone, IE/IM,
NCM, CFOP, CST, CNAE — keep `replace(/\D/g, '')`, because loosening those would stop filtering
the garbage they filter today.
