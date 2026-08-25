---
'@adatechnology/user-ui': minor
---

`TeamWorkspace` passa a funcionar sem `UserProvider`, recebendo a API por prop.

Montar só a tela de equipe exigia um provider com os **seis** métodos de autenticação implementados
— e um `getProfile()` no boot que duplicaria o bootstrap que o host já faz. Para um produto que
resolve sessão por conta própria, isso é um provider inteiro de fachada só para satisfazer o
contexto.

Agora `TeamWorkspace` aceita `api`, com só os três métodos de equipe (`TeamApi`). Presente, nenhum
provider é necessário; ausente, continua lendo do contexto como antes.

Também exportado: `useOptionalUserApi()`, que devolve `undefined` em vez de lançar quando não há
provider — é o que permite o hook decidir sem chamada condicional.

Compatível: quem já usa dentro do `UserProvider` não muda nada.
