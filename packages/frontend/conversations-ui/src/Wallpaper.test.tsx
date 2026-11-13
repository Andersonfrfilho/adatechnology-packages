import { describe, expect, it } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'

import { ConversationWallpaper } from './Wallpaper'

describe('ConversationWallpaper', () => {
  it('desenha o fundo sozinho, sem depender do styles.css do host', () => {
    const markup = renderToStaticMarkup(<ConversationWallpaper />)

    expect(markup).toContain('background-color:#efeae2')
    expect(markup).toContain('background-image:url(&quot;data:image/svg+xml,')
    expect(markup).toContain('cv-wallpaper')
  })

  it('deixa o produto sobrescrever o fundo por style', () => {
    const markup = renderToStaticMarkup(<ConversationWallpaper style={{ backgroundColor: '#123456' }} />)

    expect(markup).toContain('background-color:#123456')
    expect(markup).not.toContain('background-color:#efeae2')
  })
})
