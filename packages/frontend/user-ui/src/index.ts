export { UserWorkspace, DEFAULT_USER_LABELS } from './workspace'
export type { UserWorkspaceProps, UserLabels } from './workspace'

export { SignInScreen } from './SignInScreen'
export type { SignInScreenProps } from './SignInScreen'

export { ForgotPasswordScreen } from './ForgotPasswordScreen'
export type { ForgotPasswordScreenProps } from './ForgotPasswordScreen'

export { ResetPasswordScreen } from './ResetPasswordScreen'
export type { ResetPasswordScreenProps } from './ResetPasswordScreen'

export { SignInForm } from './SignInForm'
export type { SignInFormProps } from './SignInForm'

export { ForgotPasswordForm } from './ForgotPasswordForm'
export type { ForgotPasswordFormProps } from './ForgotPasswordForm'

export { ResetPasswordForm } from './ResetPasswordForm'
export type { ResetPasswordFormProps } from './ResetPasswordForm'

export { ProfileEditForm } from './ProfileEditForm'
export type { ProfileEditFormProps } from './ProfileEditForm'

export { ChangePasswordForm } from './ChangePasswordForm'
export type { ChangePasswordFormProps } from './ChangePasswordForm'

export { useSignIn } from './useSignIn'
export type { UseSignInResult } from './useSignIn'

export { usePasswordReset, PASSWORD_RESET_STEP } from './usePasswordReset'
export type { UsePasswordResetResult, PasswordResetStep } from './usePasswordReset'

export { useProfile } from './useProfile'
export type { UseProfileResult } from './useProfile'

export { UserProvider, useUser, useUserConfig, useUserApi } from './providers/UserProvider'
export type { UserProviderProps } from './providers/UserProvider'

export { SESSION_STATUS, DEFAULT_USER_CONFIG } from './providers/types'
export type {
  UserProfile,
  UserSession,
  SessionStatus,
  UserApi,
  UserConfig,
  SignInParams,
  UpdateProfileInput,
  ConfirmPasswordResetParams,
} from './providers/types'

/** Tela COMPOSTA de equipe — listagem, cadastro e ativacao. Some quando a `UserApi` nao traz `listTeam`. */
export { TeamWorkspace } from './workspace/TeamWorkspace'
export type { TeamWorkspaceProps } from './workspace/TeamWorkspace'
export { TeamMemberForm, TEAM_PASSWORD_MIN_LENGTH } from './TeamMemberForm'
export type { TeamMemberFormProps } from './TeamMemberForm'
export { useTeam, TEAM_DEFAULT_PAGE_SIZE } from './useTeam'
export type { UseTeamResult } from './useTeam'
export type { TeamPage, ListTeamParams, CreateTeamMemberInput } from './providers/types'
