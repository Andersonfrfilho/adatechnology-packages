# @adatechnology/document-intake

Reads Brazilian documents (CRLV, CNH, CCMEI) in the browser and, since 0.2.0, carries the **pure helpers for
CPF/CNPJ and person names**. Those helpers have no DOM dependency and also run on the server.

## CPF and CNPJ

```ts
import {
  detectBrazilianDocumentKind, // 'cpf' | 'cnpj' | undefined
  isValidBrazilianDocument, // size + check digits; repeated digits refused
  formatBrazilianDocument, // 000.000.000-00 / 00.000.000/0000-00
  maskBrazilianDocumentInput, // progressive mask for ONE field that takes either
  maskBrazilianDocumentForDisplay, // •••.•••.•47-25 (last 4 visible by default)
  normalizeBrazilianDocument, // strips only the mask; letters are kept
} from '@adatechnology/document-intake'
```

- The **alphanumeric CNPJ** (IN RFB 2229/2024) is supported: letters are allowed in the first 12 positions,
  the last two are digits. Never normalize with `replace(/\D/g, '')` — the letters would vanish.
- `maskBrazilianDocumentInput` shows the CPF mask up to 11 digits and switches to the CNPJ mask on the 12th
  character or on any letter. Store `normalizeBrazilianDocument(value)`.
- `maskBrazilianDocumentForDisplay(value, { visibleCharacters })` keeps the punctuation and hides all but the last N.

## Person names

`normalizePersonName('  JOSÉ   DA SILVA ')` → `José da Silva`. Particles `da de do das dos e` stay lower-case
except as the first word; `d'ávila` → `D'Ávila`; `ana-maria` → `Ana-Maria`.

A ready input lives in `@adatechnology/customers-ui` (`BrazilianDocumentInput`).

## Reading PDFs

See `src/index.ts` for `readCrlv`, `extractCnhFields`, `readCcmei` and the OCR fallback.
