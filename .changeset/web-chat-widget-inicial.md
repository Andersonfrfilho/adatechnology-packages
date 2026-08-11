---
'@adatechnology/web-chat-widget': minor
---

Chat de site como Web Component nativo, extraído do `ada-technology`.

Shadow DOM fechado, sem framework: bolhas agrupadas com rabinho e divisor de data, botões de resposta
rápida, `autocomplete` guiado pelo `answerKind` da API, nota de voz por `MediaRecorder` com
transcrição no servidor, tema claro/escuro pelo sistema e mascote em SVG. Marcação `*negrito*` /
`_itálico_` é renderizada por `createElement`, nunca `innerHTML`.

Falha de áudio é traduzida pelo `code` do envelope de erro, não pelo status HTTP: cota estourada
mostra o prazo do `Retry-After`, engine fora do ar convida a escrever.
