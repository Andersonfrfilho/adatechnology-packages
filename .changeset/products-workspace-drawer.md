---
"@adatechnology/products-ui": patch
---

O painel de edição de produto deixa de espremer a lista, e a tabela volta a rolar.

Abrir "Novo produto" quebrava a tela em três larguras diferentes, e por três motivos distintos.

**A lista sumia abaixo de 1024px.** A linha que abriga lista e painel é `flex` em qualquer largura,
mas o painel era `w-full shrink-0` fora do `desktop:`. Num flex-row isso reserva a largura inteira
do contêiner e recusa encolher, então a lista — `flex-1`, base zero — ficava com 0px e desaparecia
atrás do `overflow-hidden`. Clicar em "Novo produto" no notebook fazia os produtos evaporarem.

**Entre 1024px e 1280px sobravam 320px de tabela.** A barra de catálogos (16rem) e o painel (28rem)
somam 44rem fixos; o que restava não era uma tabela, era uma tira. Agora o painel só divide a linha
a partir de `wide:`, onde há largura para os dois. Abaixo disso ele flutua sobre a lista, com fundo
clicável e `Esc` para fechar — a lista fica atrás, inteira, em vez de espremida.

**A tabela nunca rolava na horizontal.** O `overflow-x-auto` do contêiner era letra morta enquanto a
`<table>` fosse `w-full`: ela encolhia até caber e nunca transbordava. As colunas se esmagavam, o
cabeçalho quebrava em duas linhas e o código de barras ficava escondido atrás da borda. Com
`min-w-max` ela para de encolher no conteúdo e a rolagem passa a existir de fato; `whitespace-nowrap`
no cabeçalho e nas colunas de número impede que a altura da linha mude conforme a largura da janela.

O formulário passa a medir a coluna onde vive, e não a janela. O `md:grid-cols-2` disparava a partir
de 768px de **viewport**, então dentro de um painel de 28rem ele abria duas colunas de 200px e o
campo de código de barras nascia cortado. Trocado por consulta de contêiner (`@container` +
`@sm:grid-cols-2`): duas colunas quando a coluna comporta, uma quando não comporta.

O cabeçalho do painel (título, Excluir, Fechar) sai da área de rolagem. O formulário é longo, e
"Fechar" que sobe junto com o scroll deixa o painel sem saída visível no meio do caminho.

`closeDraft` passa a ser estável entre renders — a tela assina o `Esc` com essa referência, e uma
função nova a cada resposta da listagem trocaria o listener a cada tecla digitada na busca.
