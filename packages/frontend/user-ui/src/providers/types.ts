/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Tipos mínimos redeclarados — `user-ui` não depende de `@adatechnology/user-contracts`, mesma
 * decisão de `products-ui` para manter o bundle do browser livre de zod.
 */

export type UserProfile = {
  readonly id: string
  readonly email: string
  readonly name: string
  readonly role: string
  readonly companyId?: string
  readonly isActive: boolean
  readonly lastSeenAt?: string
  /** URL assinada e de vida curta. Ausente = sem foto, ou sem armazenamento no host. */
  readonly avatarUrl?: string
}

export type UserSession = {
  readonly accessToken: string
  readonly expiresInSeconds: number
  readonly refreshToken: string
  readonly refreshExpiresInSeconds: number
  readonly user: UserProfile
}

export const SESSION_STATUS = {
  LOADING: 'loading',
  AUTHENTICATED: 'authenticated',
  UNAUTHENTICATED: 'unauthenticated',
} as const
export type SessionStatus = (typeof SESSION_STATUS)[keyof typeof SESSION_STATUS]

export type SignInParams = {
  readonly email: string
  readonly password: string
}

export type UpdateProfileInput = {
  readonly name: string
}

export type ConfirmPasswordResetParams = {
  readonly token: string
  readonly newPassword: string
}

export type TeamPage = {
  readonly items: readonly UserProfile[]
  readonly total: number
  readonly page: number
  readonly pageSize: number
}

export type ListTeamParams = {
  readonly page: number
  readonly pageSize: number
}

export type UpdateTeamMemberInput = {
  readonly name: string
  readonly role: string
}

export type CreateTeamMemberInput = {
  readonly email: string
  readonly name: string
  readonly password: string
  readonly role: string
}

export type UserApi = {
  readonly signIn: (params: SignInParams) => Promise<UserSession>
  readonly signOut: () => Promise<void>
  readonly getProfile: () => Promise<UserProfile>
  readonly updateProfile: (input: UpdateProfileInput) => Promise<UserProfile>
  /** Foto do proprio usuario. Ausente = host sem armazenamento; o controle nao aparece. */
  readonly setOwnAvatar?: (file: File) => Promise<UserProfile>
  readonly requestPasswordReset: (email: string) => Promise<void>
  readonly confirmPasswordReset: (params: ConfirmPasswordResetParams) => Promise<void>
  /**
   * Administração de equipe — OPCIONAL, e é a ausência que desliga a tela.
   *
   * Nem todo produto expõe as rotas de admin do `user-module`, e vários não têm sequer a noção de
   * equipe. Tornar isto obrigatório quebraria todo consumidor atual e forçaria implementações vazias
   * que lançam — pior que a capacidade não existir.
   */
  readonly listTeam?: (params: ListTeamParams) => Promise<TeamPage>
  readonly createTeamMember?: (input: CreateTeamMemberInput) => Promise<UserProfile>
  /** Ausente, a tela não desenha a coluna de ação — desativar é destrutivo e nem todo produto quer. */
  readonly setTeamMemberActive?: (userId: string, isActive: boolean) => Promise<UserProfile>
  /** Ausente esconde a acao de editar — nome e papel viram somente leitura. */
  readonly updateTeamMember?: (userId: string, input: UpdateTeamMemberInput) => Promise<UserProfile>
  /** Ausente quando o host nao plugou armazenamento — o controle de foto nem aparece. */
  readonly setTeamMemberAvatar?: (userId: string, file: File) => Promise<UserProfile>
  /** Ausente quando o host nao tem reset de senha E e-mail — botao que nao entrega nada nao existe. */
  readonly sendPasswordReset?: (userId: string) => Promise<void>
}

export type UserConfig = {
  /** Se `false`, o `UserProvider` não chama `api.getProfile()` na montagem — o host decide quando. */
  readonly autoFetchProfile: boolean
}

export const DEFAULT_USER_CONFIG: UserConfig = {
  autoFetchProfile: true,
}
