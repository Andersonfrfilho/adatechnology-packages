---
'@adatechnology/notification-contracts': patch
---

`checkEmailAttachment` aceita `http` em loopback.

A regra de `https` existe para um documento pessoal não trafegar em claro pela internet — e loopback
não é a internet: o pacote nunca sai da máquina. Sem a exceção, todo ambiente local com MinIO em
`http://localhost` reprovava o anexo antes de qualquer teste, e a única saída seria afrouxar a regra
em produção junto.

Loopback e mais nada. `http://storage.interno` e `http://192.168.0.10` continuam reprovados: "rede
interna" é promessa de topologia que este pacote não tem como verificar.

Achado testando a cadeia ponta a ponta contra o MinIO do `docker-compose` — o driver recusou o
anexo com `attachment_url_not_https`, que era a regra funcionando e o ambiente local inviável.
