/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */
import { describe, expect, it } from 'bun:test'

import { buildIcsEvent, extractCalendarDataBlocks, parseIcsEvent } from './caldav-calendar-provider.ics'

describe('buildIcsEvent', () => {
  it('gera um VEVENT com UID, horários e resumo', () => {
    const ics = buildIcsEvent({
      uid: 'event-1',
      payload: {
        title: 'Consulta',
        startsAt: new Date('2026-08-20T10:00:00.000Z'),
        endsAt: new Date('2026-08-20T11:00:00.000Z'),
        notes: 'Trazer exames',
      },
      stampedAt: new Date('2026-08-14T00:00:00.000Z'),
    })

    expect(ics).toContain('UID:event-1')
    expect(ics).toContain('DTSTART:20260820T100000Z')
    expect(ics).toContain('DTEND:20260820T110000Z')
    expect(ics).toContain('SUMMARY:Consulta')
    expect(ics).toContain('DESCRIPTION:Trazer exames')
  })

  it('escapa vírgula, ponto e vírgula e quebra de linha no texto', () => {
    const ics = buildIcsEvent({
      uid: 'event-1',
      payload: {
        title: 'Consulta, retorno; anual\ncom check-up',
        startsAt: new Date('2026-08-20T10:00:00.000Z'),
        endsAt: new Date('2026-08-20T11:00:00.000Z'),
      },
      stampedAt: new Date('2026-08-14T00:00:00.000Z'),
    })

    expect(ics).toContain('SUMMARY:Consulta\\, retorno\\; anual\\ncom check-up')
  })
})

describe('parseIcsEvent', () => {
  it('extrai uid e horários de um VEVENT', () => {
    const ics = [
      'BEGIN:VCALENDAR',
      'BEGIN:VEVENT',
      'UID:event-1',
      'DTSTAMP:20260814T000000Z',
      'DTSTART:20260820T100000Z',
      'DTEND:20260820T110000Z',
      'SUMMARY:Consulta',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n')

    expect(parseIcsEvent(ics)).toEqual({
      uid: 'event-1',
      startsAt: new Date('2026-08-20T10:00:00.000Z'),
      endsAt: new Date('2026-08-20T11:00:00.000Z'),
    })
  })

  it('devolve undefined quando falta um campo obrigatório', () => {
    expect(parseIcsEvent('BEGIN:VEVENT\r\nUID:event-1\r\nEND:VEVENT')).toBeUndefined()
  })
})

describe('extractCalendarDataBlocks', () => {
  it('extrai o ICS de cada resposta do multistatus e desfaz entidades XML', () => {
    const xml = `<?xml version="1.0"?>
<D:multistatus xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:response>
    <D:propstat>
      <D:prop>
        <C:calendar-data>BEGIN:VCALENDAR&#13;&#10;UID:event-1&#13;&#10;END:VCALENDAR</C:calendar-data>
      </D:prop>
    </D:propstat>
  </D:response>
</D:multistatus>`

    const blocks = extractCalendarDataBlocks(xml)
    expect(blocks).toHaveLength(1)
    expect(blocks[0]).toContain('UID:event-1')
  })
})
