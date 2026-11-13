/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'

import {
  extractCalendarEvent,
  generateCalendarLinks,
  generateGoogleCalendarUrl,
  generateIcsContent,
  generateIcsDataUri,
  generateOffice365CalendarUrl,
  generateOutlookCalendarUrl,
  generateYahooCalendarUrl,
  type NotificationCalendarEvent,
} from './calendarEvent'

describe('calendarEvent utilities', () => {
  const sampleEvent: NotificationCalendarEvent = {
    title: 'Jogar futebol no parque com Pedro',
    description: 'Levar bola e garrafa de água',
    startsAt: new Date('2026-11-20T16:00:00.000Z'),
    endsAt: new Date('2026-11-20T17:30:00.000Z'),
    location: 'Parque Ibirapuera',
  }

  it('gerador do Google Calendar monta URL com formato correto', () => {
    const url = generateGoogleCalendarUrl(sampleEvent)
    expect(url).toStartWith('https://calendar.google.com/calendar/render?')
    expect(url).toContain('action=TEMPLATE')
    expect(url).toContain('text=Jogar+futebol+no+parque+com+Pedro')
    expect(url).toContain('dates=20261120T160000Z%2F20261120T173000Z')
    expect(url).toContain('details=Levar+bola+e+garrafa+de+%C3%A1gua')
    expect(url).toContain('location=Parque+Ibirapuera')
  })

  it('gerador do Google Calendar usa 1h padrão quando endsAt for omitido', () => {
    const url = generateGoogleCalendarUrl({
      title: 'Passeio',
      startsAt: new Date('2026-11-20T10:00:00.000Z'),
    })
    expect(url).toContain('dates=20261120T100000Z%2F20261120T110000Z')
  })

  it('gerador do Outlook monta deeplink válido', () => {
    const url = generateOutlookCalendarUrl(sampleEvent)
    expect(url).toStartWith('https://outlook.live.com/calendar/0/deeplink/compose?')
    expect(url).toContain('subject=Jogar+futebol+no+parque+com+Pedro')
    expect(url).toContain('startdt=2026-11-20T16%3A00%3A00.000Z')
    expect(url).toContain('enddt=2026-11-20T17%3A30%3A00.000Z')
  })

  it('gerador do Office 365 monta deeplink corporativo válido', () => {
    const url = generateOffice365CalendarUrl(sampleEvent)
    expect(url).toStartWith('https://outlook.office.com/calendar/0/deeplink/compose?')
    expect(url).toContain('subject=Jogar+futebol+no+parque+com+Pedro')
  })

  it('gerador do Yahoo Calendar calcula duração e monta URL correta', () => {
    const url = generateYahooCalendarUrl(sampleEvent)
    expect(url).toStartWith('https://calendar.yahoo.com/?')
    expect(url).toContain('title=Jogar+futebol+no+parque+com+Pedro')
    expect(url).toContain('st=20261120T160000Z')
    expect(url).toContain('dur=0130')
  })

  it('gerador de Data URI produz URI data:text/calendar válida', () => {
    const dataUri = generateIcsDataUri(sampleEvent)
    expect(dataUri).toStartWith('data:text/calendar;charset=utf-8,')
    expect(dataUri).toContain('BEGIN%3AVCALENDAR')
    expect(dataUri).toContain('Jogar%20futebol%20no%20parque%20com%20Pedro')
  })

  it('generateCalendarLinks devolve todos os formatos de calendário', () => {
    const links = generateCalendarLinks(sampleEvent)
    expect(links.google).toContain('calendar.google.com')
    expect(links.outlook).toContain('outlook.live.com')
    expect(links.office365).toContain('outlook.office.com')
    expect(links.yahoo).toContain('calendar.yahoo.com')
    expect(links.icsDataUri).toStartWith('data:text/calendar;charset=utf-8,')
  })

  it('gerador de ICS produz estrutura RFC 5545 com quebras CRLF', () => {
    const fixedNow = new Date('2026-11-12T12:00:00.000Z')
    const ics = generateIcsContent(sampleEvent, fixedNow)

    expect(ics).toContain('BEGIN:VCALENDAR')
    expect(ics).toContain('VERSION:2.0')
    expect(ics).toContain('BEGIN:VEVENT')
    expect(ics).toContain('SUMMARY:Jogar futebol no parque com Pedro')
    expect(ics).toContain('DESCRIPTION:Levar bola e garrafa de água')
    expect(ics).toContain('LOCATION:Parque Ibirapuera')
    expect(ics).toContain('DTSTART:20261120T160000Z')
    expect(ics).toContain('DTEND:20261120T173000Z')
    expect(ics).toContain('END:VEVENT')
    expect(ics).toContain('END:VCALENDAR')
    expect(ics).toContain('\r\n')
  })

  it('extrai evento a partir do bloco calendarEvent no payload', () => {
    const payload = {
      calendarEvent: {
        title: 'Leitura antes de dormir',
        startsAt: '2026-11-20T20:00:00.000Z',
        description: 'Livro do Pequeno Príncipe',
      },
    }

    const event = extractCalendarEvent(payload)
    expect(event).toBeDefined()
    expect(event?.title).toBe('Leitura antes de dormir')
    expect(event?.startsAt).toBe('2026-11-20T20:00:00.000Z')
    expect(event?.description).toBe('Livro do Pequeno Príncipe')
  })

  it('extrai evento a partir de chaves diretas de atividade no payload', () => {
    const payload = {
      title: 'Pintura a dedo',
      activityDate: '2026-11-22',
      activityTime: '15:00',
      description: 'Momento de arte',
    }

    const event = extractCalendarEvent(payload)
    expect(event).toBeDefined()
    expect(event?.title).toBe('Pintura a dedo')
    expect(event?.startsAt).toBe('2026-11-22T15:00:00')
    expect(event?.description).toBe('Momento de arte')
  })

  it('retorna undefined quando não houver título ou data', () => {
    expect(extractCalendarEvent({})).toBeUndefined()
    expect(extractCalendarEvent({ title: 'Apenas título' })).toBeUndefined()
    expect(extractCalendarEvent(undefined)).toBeUndefined()
  })
})
