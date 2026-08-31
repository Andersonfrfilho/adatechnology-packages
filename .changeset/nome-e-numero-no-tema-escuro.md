---
'@adatechnology/conversations-ui': patch
---

Nome, número, horário e prévia deixam de ficar escuros no tema escuro.

As cores viviam cravadas em hexadecimal na marcação, sem variante escura: o nome do cliente em
`#111b21` e número, horário e prévia da mensagem em `#667781` — os cinzas do WhatsApp **claro**. Com
o tema escuro ligado eles continuavam escuros sobre fundo escuro, e a lista de conversas virava
texto quase ilegível. O mesmo par aparecia dentro do balão, que também escurece.

O par virou constante (`CHAT_TEXT_PRIMARY_CLASS`, `CHAT_TEXT_SECONDARY_CLASS`) em vez de ser colado
em seis lugares de três arquivos: era essa repetição que permitia consertar um e esquecer os outros.
Os valores escuros são os que o próprio WhatsApp usa, para a tela não inventar paleta própria.

A classe inteira fica num literal só de propósito — o host varre o `dist` compilado para gerar o
CSS, e uma classe montada por concatenação não seria encontrada e sairia sem estilo.
