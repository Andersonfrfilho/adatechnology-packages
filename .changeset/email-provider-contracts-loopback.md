---
'@adatechnology/email-provider': patch
---

Republica contra `notification-contracts@0.1.0-rc.6`, que aceita `http` em loopback no anexo.

O `workspace:*` vira versão exata na publicação, então o `rc.6` do provider ficou preso ao `rc.5` do
contracts — a versão anterior à exceção de loopback. Na prática, o driver continuava recusando
`http://localhost` com `attachment_url_not_https` mesmo com o host já atualizado, porque ele resolvia
a própria cópia do contracts.

Sem mudança de código: o que muda é a versão do contrato que vai junto.
