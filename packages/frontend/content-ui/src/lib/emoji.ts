/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Conjunto enxuto de emojis (sem dependência): o suficiente para um post de novidades. A busca casa
 * o nome em pt-BR ou en.
 */

export type EmojiEntry = { readonly char: string; readonly keywords: string }
export type EmojiCategory = 'smileys' | 'gestures' | 'food' | 'nature' | 'travel' | 'objects' | 'symbols'

export const EMOJI_CATEGORIES: readonly EmojiCategory[] = [
  'smileys',
  'gestures',
  'food',
  'nature',
  'travel',
  'objects',
  'symbols',
]

function entries(raw: string): readonly EmojiEntry[] {
  return raw.split('|').map((item) => {
    const [char = '', keywords = ''] = item.split(':')
    return { char, keywords }
  })
}

export const EMOJI_BY_CATEGORY: Readonly<Record<EmojiCategory, readonly EmojiEntry[]>> = {
  smileys: entries(
    '😀:sorriso smile happy feliz|😁:alegre grin|😂:rindo lol laugh|😊:feliz blush|😍:amei love apaixonado|😎:legal cool|😉:piscada wink|🥰:carinho|😘:beijo kiss|🤔:pensando think|😅:aliviado|😢:triste sad cry|😭:chorando|😡:bravo angry|😴:sono sleep|🤩:uau wow estrela|🙂:simples|🙃:invertido|😇:anjo|🥳:festa party|😋:gostoso yum|🤗:abraco hug|😮:surpreso|😬:sem graca',
  ),
  gestures: entries(
    '👍:joia like ok|👎:nao dislike|👏:palmas clap|🙌:comemorar hooray|🙏:obrigado por favor thanks pray|💪:forca strong|👋:oi tchau wave|🤝:acordo handshake|✌️:paz peace|👌:perfeito|👉:direita point|👇:baixo|☝️:cima|✍️:escrever write|🤞:torcendo',
  ),
  food: entries(
    '🍕:pizza|🍔:hamburguer burger|🍟:batata fritas|🌭:cachorro quente|🍣:sushi|🍝:massa pasta|🥗:salada salad|🍰:bolo cake|🍫:chocolate|🍷:vinho wine|🍺:cerveja beer|🍹:drink coquetel|☕:cafe coffee|🥂:brinde cheers|🍎:maca apple|🍓:morango|🍉:melancia|🥐:croissant|🥩:carne steak|🍦:sorvete ice cream',
  ),
  nature: entries(
    '🌞:sol sun|🌙:lua moon|⭐:estrela star|🌈:arco-iris rainbow|🔥:fogo fire|💧:agua water|🌸:flor flower|🌹:rosa|🌳:arvore tree|🌴:palmeira palm|🍀:trevo|🐶:cachorro dog|🐱:gato cat|🐟:peixe fish|🦋:borboleta',
  ),
  travel: entries(
    '🚗:carro car|🚌:onibus|✈️:aviao plane|🚲:bicicleta|🏠:casa home|🏖️:praia beach|🏝️:ilha|🏨:hotel|📍:local pin|🗺️:mapa map|⛱️:guarda-sol|🎡:roda gigante|🌆:cidade|🛍️:compras shopping',
  ),
  objects: entries(
    '🎉:festa celebracao party|🎁:presente gift|🎂:aniversario birthday|🎶:musica music|📣:aviso megaphone|📢:anuncio|📅:calendario calendar data|⏰:horario clock|📞:telefone phone|📱:celular mobile|💻:computador|📷:foto camera|🎟️:ingresso ticket|🏆:trofeu trophy|💡:ideia idea|🔔:sino bell|📌:fixado|🔑:chave key',
  ),
  symbols: entries(
    '❤️:coracao heart amor|💛:amarelo|💙:azul|💚:verde|✨:brilho sparkles novo|✅:ok check|❌:erro x|⚠️:atencao warning|❗:importante|❓:pergunta|➡️:seta arrow|⬆️:cima|💯:cem 100|🆕:novo new|🔝:topo|💬:conversa chat|💰:dinheiro money|🆓:gratis free|♻️:reciclar',
  ),
}

export function searchEmoji(query: string): readonly EmojiEntry[] {
  const needle = query.trim().toLowerCase()
  if (!needle) return []
  return EMOJI_CATEGORIES.flatMap((category) => EMOJI_BY_CATEGORY[category]).filter((entry) =>
    entry.keywords.toLowerCase().includes(needle),
  )
}
