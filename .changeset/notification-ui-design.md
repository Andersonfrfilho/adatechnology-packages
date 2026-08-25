---
'@adatechnology/notification-ui': minor
---

A tela de templates passa a vir pronta, em vez de neutra esperando o host tematizar.

O pacote nao tem cor propria por regra (`pluggable-module.md` §4.1), e a leitura disso era um
fallback generico: azul `#3b82f6`, cinza `#e5e7eb`, raio 8px, sem hierarquia. Nenhum dos tres
produtos preencheu os `--adn-*`, entao a tela chegava sem desenho em todos eles — o mesmo problema,
tres vezes. "Sem cor propria" agora significa **derivar do acento**, e nao ficar sem desenho:
`color-mix` produz canvas, tom suave, linha e sombra a partir de `--adn-accent`, entao quem
sobrescreve um token ganha a familia inteira.

Estrutura, que era o que mais doia:

- lista com largura FIXA (320px) em vez de `2fr 3fr` — o editor encolhia junto com a janela e os
  dois quadros do preview deixavam de caber lado a lado
- preview com `zoom`, e nao `transform: scale()`: `transform` desenha menor mas nao encolhe a caixa,
  entao sobrava um rombo branco ao lado e embaixo de cada quadro
- escala 0.52, calculada para os dois quadros (600px e 375px) caberem lado a lado num painel que ja
  tem barra lateral — empilhados eles nao comparam nada, que e a unica coisa que o preview duplo faz
- linha da lista virou cartao com estado; variavel virou chip com "em uso"; rodape diz a
  consequencia ("cria a versao 4, a 3 fica no historico")
- tema escuro completo, no mesmo padrao `.dark` do `conversations-ui`
