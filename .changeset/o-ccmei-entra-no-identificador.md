---
'@adatechnology/document-intake': minor
---

`identifyDocumentKind` passa a reconhecer o CCMEI, e `DOCUMENT_KIND` ganha `'ccmei'`.

O título do CCMEI é impresso em **duas linhas** — conferido numa amostra real —, então a regra que
serve o CRLV, de casar o título dentro de um fragmento só, não reconheceria documento nenhum. Agora
o identificador considera cada linha da faixa do título e também cada par de linhas **vizinhas**.

A regra da faixa continua de pé, e é ela que separa "título" de "palavra solta": duas linhas
afastadas seguem sendo duas frases que por acaso se somam. O limite de vizinhança é a altura da
própria fonte, não um pixel mágico.

`identifyDocumentKind` não tinha teste nenhum. Ganhou sete, incluindo o CRLV como regressão e os
dois casos que a doutrina do arquivo proíbe — frase fora da faixa e linhas distantes.
