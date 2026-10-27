import { describe, expect, it } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'

import { ParticipantMessageText } from './ParticipantMessageText'
import { DEFAULT_PARTICIPANT_CONVERSATIONS_LABELS } from './participantLabels'

const LABELS = DEFAULT_PARTICIPANT_CONVERSATIONS_LABELS

function render(text: string | null | undefined, labels = LABELS): string {
  return renderToStaticMarkup(<ParticipantMessageText text={text} labels={labels} />)
}

describe('ParticipantMessageText - markup', () => {
  it('keeps plain text as minimal, stable markup', () => {
    expect(render('Olá, tudo bem?')).toBe('<div class="cv-p-text">Olá, tudo bem?</div>')
    expect(render('a\nb')).toBe('<div class="cv-p-text">a\nb</div>')
  })

  it('draws nothing for empty input', () => {
    expect(render('')).toBe('')
    expect(render('  ')).toBe('')
    expect(render(null)).toBe('')
  })

  it('renders marks as semantic elements, nested', () => {
    expect(render('*_a_* ~b~ `c`')).toBe(
      '<div class="cv-p-text"><strong><em>a</em></strong> <del>b</del> <code class="cv-p-text__code">c</code></div>',
    )
  })

  it('renders blocks as pre, blockquote and lists', () => {
    expect(render('```\nx\n```')).toBe('<div class="cv-p-text"><pre class="cv-p-text__pre"><code>x</code></pre></div>')
    expect(render('> q')).toContain('<blockquote class="cv-p-text__quote">q</blockquote>')
    expect(render('- a\n- b')).toContain('<ul class="cv-p-text__list"><li>a</li><li>b</li></ul>')
    expect(render('3. a')).toContain('<ol class="cv-p-text__list" start="3"><li>a</li></ol>')
    expect(render('1. a')).toContain('<ol class="cv-p-text__list"><li>a</li></ol>')
  })
})

describe('ParticipantMessageText - links', () => {
  it('opens http links safely in a new tab, announces it, and offers a separate copy button', () => {
    const markup = render('veja https://a.com/?a=1&b=2 já')
    expect(markup).toContain('<a class="cv-p-text__link" href="https://a.com/?a=1&amp;b=2"')
    expect(markup).toContain('rel="noopener noreferrer nofollow ugc"')
    expect(markup).toContain('target="_blank"')
    expect(markup).toContain('<span class="cv-p-sr-only"> (opens in a new tab)</span>')
    expect(markup).toContain(
      '<button type="button" class="cv-p-text__link-copy" aria-label="Copy https://a.com/?a=1&amp;b=2" data-cv-tooltip="Copy">',
    )
  })

  it('never makes the whole link a copy button', () => {
    const markup = render('https://a.com')
    expect(markup).toMatch(/<a [^>]*>https:\/\/a\.com<span[^>]*>[^<]*<\/span><\/a>/)
    expect(markup).not.toMatch(/<button[^>]*><a /)
    expect(markup.slice(markup.indexOf('<a '), markup.indexOf('</a>'))).not.toContain('<button')
    expect(markup.indexOf('</a>')).toBeLessThan(markup.indexOf('<button'))
  })

  it('uses the host label for the new-tab hint', () => {
    expect(render('https://a.com', { ...LABELS, externalLinkHint: 'abre em nova aba' })).toContain('(abre em nova aba)')
  })

  it('never links unsafe protocols', () => {
    for (const text of ['javascript:alert(1)', 'data:text/html,<b>x</b>', 'vbscript:x', 'JAVASCRIPT:alert(1)']) {
      expect(render(text)).not.toContain('<a ')
      expect(render(text)).not.toContain('href=')
    }
  })

  it('escapes hostile text: no script element and no event-handler attribute', () => {
    const markup = render('<script>alert(1)</script> <img src=x onerror=alert(1)> *<b onclick=x>*')
    expect(markup).not.toContain('<script')
    expect(markup).not.toContain('<img')
    expect(markup).not.toMatch(/<[a-z]+[^>]*\son[a-z]+=/i)
    expect(markup).toContain('&lt;script&gt;')
  })
})

describe('ParticipantMessageText - copyable tokens', () => {
  it('renders a token as an accessible button with the value as typed', () => {
    const markup = render('CPF 529.982.247-25')
    expect(markup).toContain(
      '<button type="button" class="cv-p-copyable cv-p-copyable--cpf" aria-label="Copy 529.982.247-25">529.982.247-25</button>',
    )
  })

  it('renders one button per kind and labels it from the host labels', () => {
    const markup = render('a@b.co (16) 99999-0000 11.222.333/0001-81', { ...LABELS, copyValue: 'Copiar' })
    expect(markup).toContain('cv-p-copyable--email')
    expect(markup).toContain('cv-p-copyable--phone')
    expect(markup).toContain('cv-p-copyable--cnpj')
    expect(markup).toContain('aria-label="Copiar a@b.co"')
  })

  it('does not highlight code, money, dates or short numbers', () => {
    expect(render('`529.982.247-25`')).not.toContain('cv-p-copyable')
    expect(render('R$ 1.234,56 em 10/10/2026, NF 4521 (12345)')).not.toContain('cv-p-copyable')
  })

  it('uses no live region of its own and no innerHTML', () => {
    const markup = render('a@b.co https://a.com')
    expect(markup).not.toContain('aria-live')
    expect(markup).not.toContain('dangerouslySetInnerHTML')
  })
})
