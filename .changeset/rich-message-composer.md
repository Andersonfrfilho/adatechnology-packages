---
"@adatechnology/conversations-ui": minor
---

Novo `RichMessageComposer`: a barra de composição do atendente, com texto rico, respostas rápidas,
variáveis e anexos.

Distinto do `MessageComposer`, que é um `textarea` simples: aqui a formatação vira `<strong>`/`<em>`
dentro do campo, então o operador vê o negrito em negrito enquanto escreve, e a conversão para a
notação do WhatsApp acontece só na saída.

Tudo o que aparece na barra é configurável, e são duas perguntas separadas: `toolbar` decide **quais**
ações aparecem, `tooltips` decide **o texto** de cada dica. `quickReplies` e `variables` recebem
rótulo e conteúdo prontos do host — a mecânica é do pacote, o conteúdo é do produto. `idleAction`
permite pendurar o microfone no lugar do enviar.

`ref` expõe `setContent`/`clear`/`focus`: campo `contentEditable` controlado pelo React perde o
cursor a cada tecla, então quem precisa escrever no campo de fora faz por aqui.
