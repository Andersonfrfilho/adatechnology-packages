---
"@adatechnology/conversations-ui": patch
---

`AudioRecorderButton` passa a ser exportado da raiz do pacote.

Ele nasceu dentro do simulador, mas gravar um áudio não tem nada de simulação: a barra do atendente
precisa do mesmo botão. `@adatechnology/conversations-ui/preview` segue exportando o mesmo
componente, então quem já o importava de lá não muda nada.
