---
"@adatechnology/conversations-ui": patch
---

Cabeçalho da conversa e composer passam a medir a **própria faixa**, não a janela.

Com a prévia do simulador aberta a coluna fica com metade da tela, mas pelo breakpoint da janela o
cabeçalho continuava desenhando tudo — sobrava uma letra do nome do cliente. Agora, abaixo de 720px
de faixa os utilitários viram itens do menu ⋮; abaixo de 600px as ações escritas vão junto. O nome é
o último a ceder espaço, porque é ele que identifica a conversa.

O composer segue a mesma medida: a barra em uma linha só espremia o campo de texto quando a coluna
estreitava. As larguras vivem em `composer.constant.ts` e a medição em `useContainerWidth`.
