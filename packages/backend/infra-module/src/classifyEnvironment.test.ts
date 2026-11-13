/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'

import { classifyEnvironment } from './classifyEnvironment'
import type { ClassifyEnvironmentParams } from '@adatechnology/infra-contracts'

const DEFAULT_PATTERN = 'staging'

function classify(overrides: Partial<ClassifyEnvironmentParams>): string {
  return classifyEnvironment({
    environmentName: 'staging',
    environmentId: 'env-1',
    managedPattern: DEFAULT_PATTERN,
    selfEnvironmentId: 'env-self',
    ...overrides,
  })
}

describe('classifyEnvironment', () => {
  it('classifies staging as managed', () => {
    expect(classify({ environmentName: 'staging' })).toBe('managed')
  })

  it('classifies cbni-staging as managed', () => {
    expect(classify({ environmentName: 'cbni-staging' })).toBe('managed')
  })

  it('classifies an abbreviated prod environment as protected even with a catch-all pattern', () => {
    expect(classify({ environmentName: 'prod', managedPattern: '.*' })).toBe('protected')
    expect(classify({ environmentName: 'Prod-eu', managedPattern: '.*' })).toBe('protected')
  })

  it('classifies production as protected', () => {
    expect(classify({ environmentName: 'production' })).toBe('protected')
  })

  it('classifies cbni-production as protected', () => {
    expect(classify({ environmentName: 'cbni-production' })).toBe('protected')
  })

  it('classifies production case-insensitively in any position', () => {
    expect(classify({ environmentName: 'Production-eu' })).toBe('protected')
    expect(classify({ environmentName: 'PRODUCTION' })).toBe('protected')
  })

  it('protection beats the managed pattern for staging-production', () => {
    expect(classify({ environmentName: 'staging-production' })).toBe('protected')
  })

  it('protects the own environment even when the name matches the pattern', () => {
    expect(classify({ environmentName: 'staging', environmentId: 'env-self', selfEnvironmentId: 'env-self' })).toBe(
      'protected',
    )
  })

  it('empty selfEnvironmentId never protects by id', () => {
    expect(classify({ environmentName: 'staging', environmentId: '', selfEnvironmentId: '' })).toBe('managed')
  })

  it('classifies dev as unmanaged', () => {
    expect(classify({ environmentName: 'dev' })).toBe('unmanaged')
  })

  it('honors a custom managed pattern', () => {
    const managedPattern = '^(staging|qa)$'
    expect(classify({ environmentName: 'qa', managedPattern })).toBe('managed')
    expect(classify({ environmentName: 'cbni-staging', managedPattern })).toBe('unmanaged')
  })

  it('matches the managed pattern case-insensitively', () => {
    expect(classify({ environmentName: 'STAGING' })).toBe('managed')
    expect(classify({ environmentName: 'Cbni-Staging' })).toBe('managed')
  })
})
