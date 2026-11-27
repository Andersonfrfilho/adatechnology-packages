/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

export type AccountLabels = {
  readonly currentPassword: string
  readonly newPassword: string
  readonly confirmNewPassword: string
  readonly passwordsDoNotMatch: string
  readonly changePasswordSubmit: string
  readonly changePasswordDone: string
  readonly newEmail: string
  readonly changeEmailSubmit: string
  readonly changeEmailSent: string
  readonly phone: string
  readonly changePhoneSubmit: string
  readonly emailVerified: string
  readonly emailNotVerified: string
  readonly phoneVerified: string
  readonly phoneNotVerified: string
  readonly confirmByWhatsapp: string
  readonly waitingWhatsapp: string
  readonly verificationCode: string
  readonly verificationSubmit: string
  readonly verificationResend: string
  readonly verificationSent: string
  readonly sectionPassword: string
  readonly sectionEmail: string
  readonly sectionPhone: string
  readonly recoveryTitle: string
  readonly recoveryIdentityConfirmed: string
  readonly recoveryNewEmail: string
  readonly recoverySubmit: string
  readonly recoveryUnlock: string
  readonly recoveryLocked: string
  readonly recoveryDone: string
  readonly recoveryReservations: string
}

export const DEFAULT_ACCOUNT_LABELS: AccountLabels = {
  currentPassword: 'Senha atual',
  newPassword: 'Nova senha',
  confirmNewPassword: 'Repita a nova senha',
  passwordsDoNotMatch: 'As senhas não conferem',
  changePasswordSubmit: 'Alterar senha',
  changePasswordDone: 'Senha alterada. Os outros aparelhos foram desconectados.',
  newEmail: 'Novo e-mail',
  changeEmailSubmit: 'Enviar link de confirmação',
  changeEmailSent: 'Enviamos um link para o novo endereço. Seu e-mail só muda depois que você abrir o link.',
  phone: 'Novo telefone',
  changePhoneSubmit: 'Salvar telefone',
  emailVerified: 'E-mail confirmado',
  emailNotVerified: 'E-mail não confirmado',
  phoneVerified: 'Telefone verificado',
  phoneNotVerified: 'Telefone não verificado',
  confirmByWhatsapp: 'Confirmar pelo WhatsApp',
  waitingWhatsapp: 'Envie a mensagem no WhatsApp. Esta tela atualiza sozinha.',
  verificationCode: 'Código recebido',
  verificationSubmit: 'Confirmar código',
  verificationResend: 'Reenviar código',
  verificationSent: 'Código enviado.',
  sectionPassword: 'Senha',
  sectionEmail: 'E-mail',
  sectionPhone: 'Telefone',
  recoveryTitle: 'Conta do site',
  recoveryIdentityConfirmed: 'Conferi a identidade da pessoa fora do sistema',
  recoveryNewEmail: 'Novo e-mail da conta',
  recoverySubmit: 'Trocar e-mail e enviar link de senha',
  recoveryUnlock: 'Destravar conta',
  recoveryLocked: 'Conta bloqueada por tentativas de entrada',
  recoveryDone: 'Feito.',
  recoveryReservations: 'Códigos das reservas',
}
