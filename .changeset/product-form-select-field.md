---
"@adatechnology/products-ui": patch
---

Os selects do formulário de produto ganham rótulo associado, área de toque e seta própria.

`<label>Catálogo</label>` não tinha `htmlFor` e o `<select>` não tinha `id`: clicar no rótulo não
focava o campo — alvo bem maior que a seta — e o leitor de tela anunciava um combo sem nome. Os três
campos (Catálogo, Seção, Unidade) passam por um `SelectField` que associa os dois por construção,
em vez de depender de cada call site lembrar.

A altura sobe para `min-h-11`. O `py-2` herdado do input de texto entregava 36px, abaixo dos 44px
que a regra de responsividade exige e que os botões da mesma tela já respeitavam.

A seta do sistema sai por `appearance-none` e entra um `ChevronDown`: a nativa muda de forma e de
tamanho entre navegadores, e ao lado de um input de texto o campo parecia vir de outra tela. O fundo
passa a ser explícito, porque select sem `bg` herda o do sistema e ignora o tema escuro.
