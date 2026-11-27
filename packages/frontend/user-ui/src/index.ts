export { UserWorkspace, DEFAULT_USER_LABELS } from './workspace'
export type { UserWorkspaceProps, UserLabels } from './workspace'

export { SignInScreen } from './SignInScreen'
export type { SignInScreenProps } from './SignInScreen'

export { SignUpScreen } from './SignUpScreen'
export type { SignUpScreenProps } from './SignUpScreen'

export { SignUpForm, SIGN_UP_PASSWORD_MIN_LENGTH } from './SignUpForm'
export type { SignUpFormProps } from './SignUpForm'

export { useSignUp } from './useSignUp'
export type { UseSignUpResult } from './useSignUp'

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
  SignUpParams,
  UpdateProfileInput,
  ConfirmPasswordResetParams,
} from './providers/types'

/** Tela COMPOSTA de equipe — listagem, cadastro e ativacao. Some quando a `UserApi` nao traz `listTeam`. */
export { TeamWorkspace } from './workspace/TeamWorkspace'
export type { TeamWorkspaceProps, ListExportContext } from './workspace/TeamWorkspace'
export { buildDefaultTeamRoles, resolveTeamRole, withCurrentRole, DEFAULT_TEAM_ROLE_VALUE } from './roles'
export type { TeamRoleOption, TeamRoleTone, TeamRoleFieldProps, RenderTeamRoleField } from './roles'
export { TeamMemberForm, TEAM_PASSWORD_MIN_LENGTH } from './TeamMemberForm'
export type { TeamMemberFormProps } from './TeamMemberForm'
export { useTeam, TEAM_DEFAULT_PAGE_SIZE } from './useTeam'
export type { UseTeamResult, UseTeamParams, TeamApi } from './useTeam'
export { useOptionalUserApi } from './providers/UserProvider'
export type { TeamPage, ListTeamParams, CreateTeamMemberInput } from './providers/types'

export { cropToSquare, computeSquareCrop } from './cropToSquare'
export { Avatar, initialsOf } from './Avatar'
export type { AvatarProps } from './Avatar'

export { AvatarPicker } from './AvatarPicker'
export type { AvatarPickerProps } from './AvatarPicker'

export { TeamMemberPasswordForm } from './TeamMemberPasswordForm'
export type { TeamMemberPasswordFormProps } from './TeamMemberPasswordForm'
export { TeamMemberEditForm } from './TeamMemberEditForm'
export type { TeamMemberEditFormProps } from './TeamMemberEditForm'

export { ChangePasswordWithCurrentForm } from './account/ChangePasswordWithCurrentForm'
export type { ChangePasswordWithCurrentFormProps } from './account/ChangePasswordWithCurrentForm'
export { ChangeEmailForm } from './account/ChangeEmailForm'
export type { ChangeEmailFormProps } from './account/ChangeEmailForm'
export { ChangePhoneForm } from './account/ChangePhoneForm'
export type { ChangePhoneFormProps } from './account/ChangePhoneForm'
export {
  PhoneVerificationPanel,
  buildWhatsappLink,
  DEFAULT_VERIFICATION_POLL_MILLISECONDS,
} from './account/PhoneVerificationPanel'
export type { PhoneVerificationPanelProps } from './account/PhoneVerificationPanel'
export { StaffAccountRecoveryPanel } from './account/StaffAccountRecoveryPanel'
export type { StaffAccountRecoveryPanelProps, StaffAccountSummary } from './account/StaffAccountRecoveryPanel'
export { DEFAULT_ACCOUNT_CONTROLS } from './account/accountControls'
export type { AccountControls, AccountFieldProps, AccountButtonProps } from './account/accountControls'
export { DEFAULT_ACCOUNT_LABELS } from './account/accountLabels'
export type { AccountLabels } from './account/accountLabels'
export { useAccountAction } from './account/useAccountAction'
export type {
  ChangePasswordParams,
  ChangeEmailParams,
  ChangePhoneParams,
  PhoneVerificationStart,
  RecoverAccountParams,
} from './providers/types'
