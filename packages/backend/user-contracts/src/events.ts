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
  PASSWORD_CHANGED: 'user.password.changed',
  PASSWORD_RESET_REQUESTED: 'user.password_reset.requested',
  PASSWORD_RESET_COMPLETED: 'user.password_reset.completed',
  PROFILE_UPDATED: 'user.profile.updated',
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
  readonly reason: string
}

export type PasswordChangedEvent = BaseEvent & {
  readonly type: typeof USER_EVENT.PASSWORD_CHANGED
  readonly userId: string
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

export type UserDomainEvent =
  | UserCreatedEvent
  | UserUpdatedEvent
  | LoginSucceededEvent
  | LoginFailedEvent
  | PasswordChangedEvent
  | PasswordResetRequestedEvent
  | PasswordResetCompletedEvent
  | ProfileUpdatedEvent

export type UserHooks = {
  readonly onUserCreated?: (event: UserCreatedEvent) => Promise<void> | void
  readonly onUserUpdated?: (event: UserUpdatedEvent) => Promise<void> | void
  readonly onLoginSucceeded?: (event: LoginSucceededEvent) => Promise<void> | void
  readonly onLoginFailed?: (event: LoginFailedEvent) => Promise<void> | void
  readonly onPasswordChanged?: (event: PasswordChangedEvent) => Promise<void> | void
  readonly onPasswordResetRequested?: (event: PasswordResetRequestedEvent) => Promise<void> | void
  readonly onPasswordResetCompleted?: (event: PasswordResetCompletedEvent) => Promise<void> | void
  readonly onProfileUpdated?: (event: ProfileUpdatedEvent) => Promise<void> | void
}
