---
'@adatechnology/products-ui': minor
---

Separa produtos e catálogos em áreas navegáveis

O acesso aos catálogos era um par de botões à direita do campo de busca, na altura dos filtros:
quem abria a tela lia "Catálogo", via uma lista de produtos, e não achava onde ficavam os
catálogos — o único caminho estava disfarçado de filtro. Agora a navegação fica abaixo do título,
com ícone e estado ativo visível, que é o que ela sempre foi.

As ações passam a viver na área a que pertencem: "Novo produto" e "Importar CSV" saíram do
cabeçalho da tela, porque não significam nada enquanto se edita catálogo.

`area` e `onAreaChange` são opcionais e controlados pelo host — é assim que a área aberta vai para
a query string e sobrevive ao refresh e ao link colado. Sem eles a tela controla a própria área,
e nada muda para quem já consome.

Ícone de biblioteca (`lucide-react`) nas ações com convenção estabelecida: novo, importar, buscar,
excluir e fechar.
