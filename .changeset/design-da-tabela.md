---
'@adatechnology/user-ui': minor
---

A tabela pinta a propria superficie, ganha etiquetas de estado e passa a aceitar troca de e-mail.

**A zebra existia e era invisivel.** As listras eram `gray-50` e o painel que consome esta tela
tambem e `gray-50` — linha listrada e fundo da pagina davam exatamente na mesma cor. A correcao nao e
escurecer a listra: e a tabela estabelecer a propria base (`bg-white` / `gray-900`), porque componente
de pacote nao sabe em que fundo vai cair. Cabecalho com fundo proprio, linha com estado de hover, e a
listra um passo acima da superficie, nao do host.

Papel e situacao viram etiqueta colorida. Como texto solto tinham o mesmo peso do nome e do e-mail, e
a tabela lia como uma parede de cinza uniforme — numa lista de pessoas ninguem le linha por linha, se
varre com o olho, e e a cor que faz "Inativo" saltar.

**O e-mail passa a ser editavel.** Ele estava travado com o argumento de que a trilha de auditoria
apontaria para outra pessoa; o argumento nao se sustenta — a trilha guarda o id do ator, nao o
endereco. E gente muda de endereco com frequencia suficiente para a alternativa ser recriar a conta e
perder o historico.

A duplicidade e decidida pelo indice unico do banco, nunca por uma consulta antes: entre a consulta e
a escrita cabe outra escrita. O erro volta com codigo estavel e a tela o ancora NO campo
(`aria-invalid` + `aria-describedby`), em vez de um aviso solto no rodape que obriga a cacar qual
campo recusou.
