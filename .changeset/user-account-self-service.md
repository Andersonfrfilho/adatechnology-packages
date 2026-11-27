---
'@adatechnology/user-contracts': minor
'@adatechnology/user-module': minor
---

Autoatendimento da conta no `user-module`: troca de senha com a senha atual (encerra as outras sessões e mantém a atual), troca de e-mail com link de uso único ao endereço novo (a conta mantém o antigo até confirmar; o aviso ao antigo é o hook `onEmailChanged`), troca de telefone (senha atual, número válido e único, salvo como não verificado), verificação do telefone com método escolhido pela configuração (`whatsapp-inbound` gratuito por padrão, mais `matchInboundPhoneVerification` para o webhook do WhatsApp; canais de envio `VerificationCodeSenderPort` preparados e desligados) e recuperação assistida pela equipe (`POST /admin/users/:id/recovery`: troca de e-mail com link de nova senha e destravar, auditada por `onAccountRecovered`, sem valores). Migration `0005`: `users.email_verified_at`, `phone`, `phone_verified_at` e `user.account_challenges`. `UserProfile` ganha `emailVerified`, `phone` e `phoneVerified`.
