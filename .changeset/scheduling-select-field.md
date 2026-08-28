---
'@adatechnology/scheduling-ui': patch
---

Os seis selects da tela saem do nativo e viram um campo com busca

O `<select>` do sistema não aceita busca, não estiliza a lista aberta e muda de forma entre
navegadores — na lista de recursos, que cresce com o cadastro, isso vira rolagem cega numa caixa
que não se parece com o resto da tela (`web.md` §11). Entra um `SelectField` próprio: gatilho com
`role="combobox"`, lista `role="listbox"`, seta, marca de selecionado, e busca que aparece sozinha a
partir de oito opções.

O teclado continua fazendo o que o nativo fazia e um pouco mais: setas, Home, End, Enter, Escape,
Tab, e salto por digitação nas listas sem busca. A busca ignora acento — "salao terreo" acha
"Salão Térreo", que é o que alguém digita no celular.

A lista abre para cima quando não cabe abaixo. Os formulários vivem dentro de um painel que rola, e
sem isso a lista saía cortada pelo `overflow` do painel.

O fuso do recurso deixa de ser campo de texto livre e passa a sair de `Intl.supportedValuesOf`, com
busca. Digitar fuso à mão erra a grafia e só falha depois, na hora de calcular horário; o valor já
salvo entra na lista mesmo que o runtime não o conheça, senão editar um recurso antigo apagaria o
fuso dele em silêncio.

Mês e dia ficam sem caixa de busca de propósito: são listas fixas e ordinais, onde digitar já salta
para a opção e um filtro por "2" devolveria 2, 12 e 20–29.
