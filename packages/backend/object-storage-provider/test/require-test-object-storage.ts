/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */
const requiredVariables = [
  'OBJECT_STORAGE_TEST_ENDPOINT',
  'OBJECT_STORAGE_TEST_REGION',
  'OBJECT_STORAGE_TEST_ACCESS_KEY_ID',
  'OBJECT_STORAGE_TEST_SECRET_ACCESS_KEY',
] as const

for (const variableName of requiredVariables) {
  if (!process.env[variableName]) {
    throw new Error(`${variableName} is required for object storage integration tests`)
  }
}
