import { describe, expect, test } from 'bun:test'

import { computeSquareCrop } from './cropToSquare'

describe('computeSquareCrop', () => {
  test('centers a landscape photo and caps the output side', () => {
    expect(computeSquareCrop({ width: 1600, height: 1000, maxSide: 512 })).toEqual({
      sourceX: 300,
      sourceY: 0,
      sourceSide: 1000,
      outputSide: 512,
    })
  })

  test('centers a portrait photo', () => {
    expect(computeSquareCrop({ width: 600, height: 900, maxSide: 1024 })).toEqual({
      sourceX: 0,
      sourceY: 150,
      sourceSide: 600,
      outputSide: 600,
    })
  })

  test('keeps a square photo whole', () => {
    expect(computeSquareCrop({ width: 400, height: 400, maxSide: 512 }).sourceX).toBe(0)
  })
})
