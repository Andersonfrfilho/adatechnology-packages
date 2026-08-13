---
"@adatechnology/products-ui": patch
---

Barra de catálogos com hierarquia de painel lateral e formulário dentro da janela

O cabeçalho da barra virou rótulo de seção com ícone e contagem, e "novo catálogo"
virou botão discreto de ícone: o botão primário azul num painel de 16rem competia com
"Novo produto", que é a ação principal da área. Os itens ganharam ícone de pasta,
altura de toque de 44px, contagem em `tabular-nums` e "editar" como ícone; os órfãos
saem do itálico e passam a ser separados por uma divisória.

A linha do workspace ganhou `overflow-hidden` e a área de produtos `min-w-0`: sem isso
a tabela larga empurrava o painel de edição para fora da margem direita da tela.
