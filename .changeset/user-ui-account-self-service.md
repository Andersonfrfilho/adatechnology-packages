---
'@adatechnology/user-ui': minor
---

Telas de segurança da conta, sem controle nativo fixo (campo e botão são slots `controls`, rótulos em `labels`): `ChangePasswordWithCurrentForm`, `ChangeEmailForm`, `ChangePhoneForm`, `PhoneVerificationPanel` ("Confirmar pelo WhatsApp" com `wa.me` e mensagem pronta, atualização automática; ou campo do código nos métodos de envio) e `StaffAccountRecoveryPanel` (seção da ficha para a equipe: situação, troca de e-mail assistida e destravar). `UserApi` ganha `changePassword`, `requestEmailChange`, `changePhone`, `startPhoneVerification`, `verifyPhone` e `recoverTeamMember`, todos opcionais; `UserProfile` ganha `emailVerified`, `phone` e `phoneVerified`.
