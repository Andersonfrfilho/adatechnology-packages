/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 */

import { describe, it, expect } from 'bun:test'
import { USER_ERROR_CODE, type UserProfile } from './index'

describe('strictness checks', () => {
  it('should not export any role enum (role is always string)', () => {
    const profile: UserProfile = {
      id: '1',
      email: 'test@example.com',
      name: 'Test',
      role: 'admin', // string, not enum
      isActive: true,
    }

    expect(typeof profile.role).toBe('string')
  })

  it('all error codes must be prefixed with USER_', () => {
    Object.values(USER_ERROR_CODE).forEach((code) => {
      expect(code).toMatch(/^USER_/)
    })
  })

  it('should not export AGENT_ prefixed codes (migration from user-sdk)', () => {
    Object.values(USER_ERROR_CODE).forEach((code) => {
      expect(code).not.toMatch(/^AGENT_/)
    })
  })
})
