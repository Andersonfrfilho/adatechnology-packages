---
'@adatechnology/meta-whatsapp-contracts': patch
---

`hashWaMessageId` deixa de importar `node:crypto`: o SHA-256 passa a ser JS puro, com saída idêntica. O pacote volta a poder entrar no bundle do navegador (Vite), que quebrava desde a 0.5.0.
