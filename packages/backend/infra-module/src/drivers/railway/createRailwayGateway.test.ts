/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'

import { createRailwayGateway } from './createRailwayGateway'
import { RailwayGateway } from './RailwayGateway'

describe('createRailwayGateway', () => {
  it('returns undefined when the token is empty so the Infra module stays off', () => {
    expect(createRailwayGateway({ token: '', workspaceId: '' })).toBeUndefined()
  })

  it('returns a gateway when a token is configured', () => {
    expect(createRailwayGateway({ token: 'test-token', workspaceId: 'workspace-1' })).toBeInstanceOf(RailwayGateway)
  })
})
