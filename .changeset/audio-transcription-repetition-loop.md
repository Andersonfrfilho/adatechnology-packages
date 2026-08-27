---
'@adatechnology/audio-transcription-provider': minor
---

Corta o loop de repetição do Whisper em dois níveis, e exporta `collapseRepetitions`.

O modelo trava repetindo a mesma frase até esgotar a janela quando o áudio tem silêncio, ruído
ou fala sobreposta — acontece no Groq, no whisper.cpp e no navegador igual, porque é
comportamento do modelo, não do runtime. Uma transcrição de sete minutos voltava com a mesma
oração noventa vezes.

- `whisper.cpp` passa a rodar com `--max-context 0`: cada janela de 30s decodifica sozinha, sem
  receber o texto da anterior como prompt. É esse carregamento que alimenta o loop — a frase
  repetida entra no prompt da janela seguinte e se confirma ali.
- Os dois motores aplicam `collapseRepetitions` no texto antes de devolver. Mitigação de
  decodificação reduz o loop, não elimina; o colapso no texto é a rede embaixo. Duas repetições
  continuam passando (ênfase legítima), o corte começa na terceira.

`text` já vem colapsado — quem consome **não deve** aplicar de novo.

Recomendação de modelo local passa de `small` para `large-v3-turbo`: 7min38s de pt-BR em 61,9s
num M3 Pro com Metal, sem loop.
