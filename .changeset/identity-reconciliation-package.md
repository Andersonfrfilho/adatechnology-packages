---
'@adatechnology/identity-reconciliation': minor
---

Add the identity reconciliation package

Casar a base de usuários de um produto com o realm do provedor é regra que todo produto com login
federado reimplementa — e reimplementa errado, quase sempre casando por e-mail primeiro. Ela é pura:
não lê provedor, não toca banco, não tem dependência.

Os três degraus, na ordem da confiança: `subject`, depois **documento**, depois e-mail. O documento
vem antes porque a pessoa tem um só e pode ter vários endereços; casar por e-mail primeiro faz a
mesma pessoa aparecer duas vezes sempre que os dois lados guardam endereços diferentes. O e-mail é
**conjunto**, casado por interseção, e o resultado diz qual endereço casou.

O contrato de vínculo é deliberadamente pobre — `id`, `document`, `emails`, `subject?` — e cada
produto extrai o dele. Canal, papel e situação ficam no produto: o que entra neste tipo passa a
valer para todos os que o consomem.

⚠️ O pacote não faz login funcionar com vários e-mails: isso é configuração de realm, não casamento.
