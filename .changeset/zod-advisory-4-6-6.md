---
'@adatechnology/expense-mcp': patch
'@adatechnology/audio-transcription-mcp': patch
---

Dependência `zod` sobe de `^4.4.3` para `^4.6.6` (GHSA-mrhx-c7xc-m3w5: validação de array com limite de tamanho acumulava uma issue por elemento e esgotava memória; corrigido em 4.6.6). O lockfile passa de 4.6.5 para 4.6.7 e um override `zod@>=4 <4.6.6` impede resolver a faixa vulnerável por dependência transitiva. Sem mudança de API.
