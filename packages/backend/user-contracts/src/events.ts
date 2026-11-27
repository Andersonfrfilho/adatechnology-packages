/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 */

import type { UserProfile } from './user.types'

export const USER_EVENT = {
  USER_CREATED: 'user.user.created',
  USER_UPDATED: 'user.user.updated',
  LOGIN_SUCCEEDED: 'user.login.succeeded',
  LOGIN_FAILED: 'user.login.failed',
  USER_LOCKED: 'user.account.locked',
  REFRESH_REUSE_DETECTED: 'user.refresh.reuse_detected',
  PASSWORD_CHANGED: 'user.password.changed',
  PASSWORD_RESET_REQUESTED: 'user.password_reset.requested',
  PASSWORD_RESET_COMPLETED: 'user.password_reset.completed',
  PROFILE_UPDATED: 'user.profile.updated',
  EMAIL_CHANGE_REQUESTED: 'user.email_change.requested',
  EMAIL_CHANGED: 'user.email.changed',
  PHONE_CHANGED: 'user.phone.changed',
  PHONE_VERIFIED: 'user.phone.verified',
  ACCOUNT_RECOVERED: 'user.account.recovered',
} as const

export type UserEventType = (typeof USER_EVENT)[keyof typeof USER_EVENT]

export type BaseEvent = {
  readonly companyId?: string
  readonly occurredAt: Date
}

export type UserCreatedEvent = BaseEvent & {
  readonly type: typeof USER_EVENT.USER_CREATED
  readonly userId: string
  readonly email: string
}

export type UserUpdatedEvent = BaseEvent & {
  readonly type: typeof USER_EVENT.USER_UPDATED
  readonly userId: string
  readonly user: UserProfile
  /** Preenchido pela atualização administrativa; ausente nos demais caminhos que emitem o evento. */
  readonly changes?: UserUpdateChanges
}

export type UserUpdateChanges = {
  readonly role?: { readonly from: string; readonly to: string }
  readonly isActive?: { readonly from: boolean; readonly to: boolean }
  /** O bloqueio por tentativas falhas foi limpo. */
  readonly unlocked?: boolean
  /** Os refresh tokens do usuário foram revogados (troca de papel ou desativação). */
  readonly sessionsRevoked: boolean
}

export type LoginSucceededEvent = BaseEvent & {
  readonly type: typeof USER_EVENT.LOGIN_SUCCEEDED
  readonly userId: string
  readonly email: string
  readonly ipAddress: string
}

export type LoginFailedEvent = BaseEvent & {
  readonly type: typeof USER_EVENT.LOGIN_FAILED
  readonly email: string
  readonly ipAddress: string
  /** `user_not_found` | `invalid_password` | `user_inactive` | `user_locked` */
  readonly reason: string
  /** Ausente quando a conta não existe. */
  readonly userId?: string
}

export type UserLockedEvent = BaseEvent & {
  readonly type: typeof USER_EVENT.USER_LOCKED
  readonly userId: string
  readonly email: string
  readonly failedAttempts: number
  readonly lockedUntil: Date
}

/** Um refresh token já rotacionado foi reapresentado; todas as sessões do usuário foram revogadas. */
export type RefreshReuseDetectedEvent = BaseEvent & {
  readonly type: typeof USER_EVENT.REFRESH_REUSE_DETECTED
  readonly userId: string
}

export type PasswordChangedEvent = BaseEvent & {
  readonly type: typeof USER_EVENT.PASSWORD_CHANGED
  readonly userId: string
  /** Quem definiu a senha, quando foi um administrador. Ausente na redefinição pela própria pessoa. */
  readonly changedByUserId?: string
}

export type PasswordResetRequestedEvent = BaseEvent & {
  readonly type: typeof USER_EVENT.PASSWORD_RESET_REQUESTED
  readonly email: string
  readonly resetUrl: string
}

export type PasswordResetCompletedEvent = BaseEvent & {
  readonly type: typeof USER_EVENT.PASSWORD_RESET_COMPLETED
  readonly userId: string
  readonly email: string
}

export type ProfileUpdatedEvent = BaseEvent & {
  readonly type: typeof USER_EVENT.PROFILE_UPDATED
  readonly userId: string
  readonly user: UserProfile
}

/** Pedido de troca de e-mail: o host entrega o link ao NOVO endereço (o módulo também envia, se houver driver de e-mail). */
export type EmailChangeRequestedEvent = BaseEvent & {
  readonly type: typeof USER_EVENT.EMAIL_CHANGE_REQUESTED
  readonly userId: string
  readonly newEmail: string
  readonly confirmUrl: string
  readonly expiresInSeconds: number
}

/** A troca foi confirmada. `previousEmail` é o endereço que o host avisa ("seu e-mail foi alterado"). */
export type EmailChangedEvent = BaseEvent & {
  readonly type: typeof USER_EVENT.EMAIL_CHANGED
  readonly userId: string
  readonly previousEmail: string
  readonly newEmail: string
}

/** Sem o número: quem precisa dele lê a conta. `isVerificationStarted` diz se um código saiu. */
export type PhoneChangedEvent = BaseEvent & {
  readonly type: typeof USER_EVENT.PHONE_CHANGED
  readonly userId: string
  readonly isVerificationStarted: boolean
}

export type PhoneVerifiedEvent = BaseEvent & {
  readonly type: typeof USER_EVENT.PHONE_VERIFIED
  readonly userId: string
}

/** Trilha da recuperação assistida: quem agiu, em quem e o quê — nunca os valores. */
export type AccountRecoveredEvent = BaseEvent & {
  readonly type: typeof USER_EVENT.ACCOUNT_RECOVERED
  readonly userId: string
  readonly actorUserId?: string
  readonly isEmailUpdated: boolean
  readonly isUnlocked: boolean
  readonly isResetSent: boolean
}

export type UserDomainEvent =
  | EmailChangeRequestedEvent
  | EmailChangedEvent
  | PhoneChangedEvent
  | PhoneVerifiedEvent
  | AccountRecoveredEvent
  | UserCreatedEvent
  | UserUpdatedEvent
  | LoginSucceededEvent
  | LoginFailedEvent
  | UserLockedEvent
  | RefreshReuseDetectedEvent
  | PasswordChangedEvent
  | PasswordResetRequestedEvent
  | PasswordResetCompletedEvent
  | ProfileUpdatedEvent

export type UserHooks = {
  readonly onUserCreated?: (event: UserCreatedEvent) => Promise<void> | void
  readonly onUserUpdated?: (event: UserUpdatedEvent) => Promise<void> | void
  readonly onLoginSucceeded?: (event: LoginSucceededEvent) => Promise<void> | void
  readonly onLoginFailed?: (event: LoginFailedEvent) => Promise<void> | void
  readonly onUserLocked?: (event: UserLockedEvent) => Promise<void> | void
  readonly onRefreshReuseDetected?: (event: RefreshReuseDetectedEvent) => Promise<void> | void
  readonly onPasswordChanged?: (event: PasswordChangedEvent) => Promise<void> | void
  readonly onPasswordResetRequested?: (event: PasswordResetRequestedEvent) => Promise<void> | void
  readonly onPasswordResetCompleted?: (event: PasswordResetCompletedEvent) => Promise<void> | void
  readonly onProfileUpdated?: (event: ProfileUpdatedEvent) => Promise<void> | void
  readonly onEmailChangeRequested?: (event: EmailChangeRequestedEvent) => Promise<void> | void
  readonly onEmailChanged?: (event: EmailChangedEvent) => Promise<void> | void
  readonly onPhoneChanged?: (event: PhoneChangedEvent) => Promise<void> | void
  readonly onPhoneVerified?: (event: PhoneVerifiedEvent) => Promise<void> | void
  readonly onAccountRecovered?: (event: AccountRecoveredEvent) => Promise<void> | void
}
