import { describe, expect, test } from 'bun:test'
import type { Logger } from '@adatechnology/logger'

import type { TranscriptSegment } from '../types/index.js'
import { SubtitleService } from './subtitle.service.js'

// Nenhum método testado aqui escreve log: o logger só completa o construtor.
const SILENT_LOGGER = {} as unknown as Logger

function buildSegment(overrides: Partial<TranscriptSegment>): TranscriptSegment {
  return {
    id: 'segment-id',
    jobId: 'job-id',
    sequenceNumber: 0,
    startTime: 0,
    endTime: 1,
    originalText: 'Olá',
    ...overrides,
  }
}

describe('SubtitleService', () => {
  const service = new SubtitleService(SILENT_LOGGER)

  test('gera SRT com sequência, tempo com vírgula e linha em branco entre blocos', () => {
    const srt = service.generateSRT([
      buildSegment({ startTime: 0.5, endTime: 2.1, originalText: 'Primeira fala' }),
      buildSegment({ startTime: 3661, endTime: 3662.25, originalText: 'Segunda fala' }),
    ])

    expect(srt).toBe(
      [
        '1',
        '00:00:00,500 --> 00:00:02,100',
        'Primeira fala',
        '',
        '2',
        '01:01:01,000 --> 01:01:02,250',
        'Segunda fala',
        '',
      ].join('\n'),
    )
  })

  test('gera VTT com cabeçalho e tempo com ponto', () => {
    const vtt = service.generateVTT([buildSegment({ startTime: 0.5, endTime: 2.1, originalText: 'Fala' })])

    expect(vtt).toBe(['WEBVTT', '', '00:00:00.500 --> 00:00:02.100', 'Fala', ''].join('\n'))
  })

  test('lê de volta o SRT que gerou, com tempo e texto preservados', () => {
    const original = [
      buildSegment({ startTime: 0.5, endTime: 2.25, originalText: 'Primeira fala' }),
      buildSegment({ startTime: 3, endTime: 4.75, originalText: 'Segunda fala' }),
    ]

    const parsed = service.parseSRT(service.generateSRT(original))

    expect(parsed.map(({ startTime, endTime, originalText }) => ({ startTime, endTime, originalText }))).toEqual([
      { startTime: 0.5, endTime: 2.25, originalText: 'Primeira fala' },
      { startTime: 3, endTime: 4.75, originalText: 'Segunda fala' },
    ])
  })

  test('junta trechos curtos e próximos, e abre bloco novo ao passar do limite de tempo', () => {
    const merged = service.mergeSegments(
      [
        buildSegment({ startTime: 0, endTime: 1, originalText: 'um' }),
        buildSegment({ startTime: 1, endTime: 2, originalText: 'dois' }),
        buildSegment({ startTime: 8, endTime: 9, originalText: 'três' }),
      ],
      5,
      100,
    )

    expect(merged.map(({ startTime, endTime, originalText }) => ({ startTime, endTime, originalText }))).toEqual([
      { startTime: 0, endTime: 2, originalText: 'um dois' },
      { startTime: 8, endTime: 9, originalText: 'três' },
    ])
  })

  test('lista vazia não junta nada', () => {
    expect(service.mergeSegments([])).toEqual([])
  })

  test('valida: aceita legenda bem formada e aponta cada problema de cada trecho', () => {
    expect(service.validateSubtitles([buildSegment({ startTime: 0, endTime: 2 })])).toEqual({
      isValid: true,
      errors: [],
    })

    expect(service.validateSubtitles([])).toEqual({ isValid: false, errors: ['No subtitle segments'] })

    const result = service.validateSubtitles([
      buildSegment({ originalText: '   ' }),
      buildSegment({ startTime: 5, endTime: 5 }),
      buildSegment({ startTime: 0, endTime: 12 }),
    ])
    expect(result.isValid).toBe(false)
    expect(result.errors).toEqual([
      'Segment 0: Empty text',
      'Segment 1: Invalid timing (start >= end)',
      'Segment 2: Duration too long (12s)',
    ])
  })
})
