---
'@adatechnology/scheduling-ui': patch
---

Corrige a segunda exceção de disponibilidade recusada em silêncio

Depois de adicionar uma exceção, os campos de data voltavam para texto vazio enquanto o
`DateTimeField` continuava desenhando o dia de hoje: o formulário parecia preenchido e o botão
recusava sem dizer nada, que é exatamente o que o campo separado veio evitar. O reset passa a
devolver o mesmo valor padrão que abre a tela.
