---
'@adatechnology/user-contracts': minor
'@adatechnology/user-module': minor
---

O `SameSite` do cookie de refresh passa a ser declarável pelo host

O cookie saía sempre `SameSite=Lax`, e `Lax` não acompanha requisição cross-site — `fetch` nunca
conta como navegação de topo. Cross-site aqui é decidido pelo **site registrável** (eTLD+1), não pelo
domínio pai: dois serviços em `*.up.railway.app` são cross-site entre si, porque `railway.app` está
na Public Suffix List. O efeito é que o login funciona, `POST /auth/refresh` sai sem cookie, e
recarregar a aba desloga — em todo host cuja tela não compartilha o site registrável com a api.

`config.refreshToken.sameSite` aceita `'lax'` (padrão, comportamento de sempre) ou `'none'`. O cookie
continua saindo `Secure` e `HttpOnly` nos dois casos — `None` é recusado pelo navegador sem `Secure`.

`buildClearRefreshTokenCookie` passa a receber a mesma política: o navegador trata `SameSite`
diferente como cookie diferente, então limpar com `Lax` o que foi emitido com `None` deixaria a
sessão viva e o logout responderia 204 sem ter desligado nada.

⚠️ `none` permite que qualquer origem inicie requisição com o cookie anexado: a defesa contra CSRF
passa a ser inteiramente do CORS e da checagem de origem do host. Declare `none` só quando a tela
estiver mesmo em outro site registrável.
