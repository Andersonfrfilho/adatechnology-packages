---
'@adatechnology/meta-whatsapp-module': minor
---

`FlowGlobalKeyword` ganha `match?: 'exact' | 'word'` (padrão `exact`, sem mudança de comportamento). Com `word`, a palavra global vale quando aparece inteira dentro da mensagem, sem acento e sem caixa; a mais longa vence. Exporta `FlowGlobalKeywordMatch`.
