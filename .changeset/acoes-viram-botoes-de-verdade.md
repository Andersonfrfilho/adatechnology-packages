---
'@adatechnology/user-ui': patch
---

As acoes de linha viram botoes com icone de verdade.

A versao anterior anunciava isso e nao entregou: o componente `RowAction` foi publicado sem nenhum
uso, e os links sublinhados continuaram no lugar. Tipagem e build passaram sem reclamar, porque
componente nao usado compila perfeitamente — e a verificacao olhou o compilador em vez de olhar o
`dist`.

Agora "Editar" e "Enviar redefinicao de senha" sao botoes com borda, icone e area de toque; "Limpar
busca" ganha o icone que faltou junto.
