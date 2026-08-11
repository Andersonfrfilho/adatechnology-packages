---
"@adatechnology/conversations-ui": minor
---

Novo `DarkModeToggle`: o botão que faltava ao lado do `useDarkMode`, que o pacote já exportava.

O hook sempre esteve lá, mas cada host reescrevia o botão em volta dele — e errava as mesmas duas
coisas. A primeira é o rótulo: quem escreve "Tema escuro" com `aria-pressed` acaba anunciando o
estado atual e a ação de destino na mesma frase, uma contradizendo a outra. Aqui o rótulo nomeia só
o destino do clique e `aria-pressed` fica de fora. A segunda é a área de toque: botão só-ícone
precisa dos 44px, e o componente aplica `cv-touch` sozinho quando não há rótulo visível.

A aparência é configurável por `className` e `classNames.icon` / `classNames.label`, resolvidos com
`tailwind-merge` — o host troca raio, espaçamento e tamanho de ícone sem herdar o utilitário do
pacote, e o botão assume o visual da barra lateral em que for montado. Utilitário de token do host
(`rounded-panel`) é o caso que o merge não reconhece como família; o JSDoc aponta a forma arbitrária
que resolve.

`showLabel` cobre os dois usos reais — ícone solto numa barra de ferramentas, ou ícone mais rótulo
no rodapé de uma barra lateral. Os textos passam por `labels`, como no resto do pacote.

**O componente é apresentacional: `isDark` e `onToggle` vêm do host**, que chama `useDarkMode` uma
vez. Ele não monta o hook por dentro de propósito. Barra lateral que também existe como gaveta fica
montada duas vezes na mesma tela, e dois controladores guardam estados iniciais separados — o
segundo botão passaria a mostrar o ícone contrário ao tema que está no ar. Com o estado no host, o
hook fica acima das duas cópias e elas concordam.
