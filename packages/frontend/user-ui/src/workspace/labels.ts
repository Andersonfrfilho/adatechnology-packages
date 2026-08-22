/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Um único conjunto de labels compartilhado por todas as telas/forms do pacote (sign-in, esqueci
 * minha senha, redefinição, conta) — mesma forma de `DEFAULT_PRODUCTS_WORKSPACE_LABELS`, override
 * parcial por merge raso.
 */

export type UserLabels = {
  readonly signInTitle: string
  readonly email: string
  readonly password: string
  readonly signInSubmit: string
  readonly forgotPasswordLink: string
  readonly signInGenericError: string

  readonly forgotPasswordTitle: string
  readonly forgotPasswordSubmit: string
  readonly forgotPasswordBackToSignIn: string
  readonly forgotPasswordRequestedMessage: string
  readonly forgotPasswordGenericError: string

  readonly resetPasswordTitle: string
  readonly newPassword: string
  readonly resetPasswordSubmit: string
  readonly resetPasswordConfirmedMessage: string
  readonly resetPasswordBackToSignIn: string
  readonly resetPasswordGenericError: string

  readonly profileTitle: string
  readonly name: string
  readonly profileSave: string
  readonly profileSavedMessage: string
  readonly changePassword: string
  readonly changePasswordSentMessage: string
  readonly profileGenericError: string
}

export const DEFAULT_USER_LABELS: UserLabels = {
  signInTitle: 'Entrar',
  email: 'E-mail',
  password: 'Senha',
  signInSubmit: 'Entrar',
  forgotPasswordLink: 'Esqueci minha senha',
  signInGenericError: 'Não foi possível entrar',

  forgotPasswordTitle: 'Redefinir senha',
  forgotPasswordSubmit: 'Enviar link de redefinição',
  forgotPasswordBackToSignIn: 'Voltar para o login',
  forgotPasswordRequestedMessage: 'Se o e-mail existir, enviamos um link de redefinição.',
  forgotPasswordGenericError: 'Não foi possível solicitar a redefinição',

  resetPasswordTitle: 'Nova senha',
  newPassword: 'Nova senha',
  resetPasswordSubmit: 'Redefinir senha',
  resetPasswordConfirmedMessage: 'Senha redefinida. Você já pode entrar com a nova senha.',
  resetPasswordBackToSignIn: 'Voltar para o login',
  resetPasswordGenericError: 'Não foi possível redefinir a senha',

  profileTitle: 'Minha conta',
  name: 'Nome',
  profileSave: 'Salvar',
  profileSavedMessage: 'Perfil atualizado.',
  changePassword: 'Alterar senha',
  changePasswordSentMessage: 'Enviamos um link de redefinição para o seu e-mail.',
  profileGenericError: 'Não foi possível atualizar o perfil',
}
