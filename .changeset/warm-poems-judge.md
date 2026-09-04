---
'@adatechnology/module-http': patch
---

`requiredScopes` passa a valer em rota de escopo `user`

O despachante autorizava a requisição assim que via `auth.userId` e nunca chegava à checagem de
escopo, então um `requiredScopes` declarado numa rota de pessoa era enfeite: quem podia ler podia
escrever. Nenhuma rota `user` dos módulos existentes declarava escopo, então o comportamento delas
não muda — o que muda é a declaração deixar de ser ignorada.
