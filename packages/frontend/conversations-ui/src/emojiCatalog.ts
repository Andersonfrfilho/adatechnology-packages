/**
 * Catálogo de emojis com palavras-chave em português, usado pela busca do seletor.
 *
 * Fica em módulo próprio (e não dentro do `EmojiPicker`) porque a busca precisa varrer TODAS as
 * categorias, não só a aberta — o índice é montado uma vez, no carregamento, e não a cada tecla.
 *
 * As palavras-chave são de busca, não legendas: incluem sinônimos e formas sem acento, porque quem
 * digita rápido escreve "coracao" e "polegar" com a mesma frequência que a forma correta.
 */

export type EmojiEntry = {
  readonly emoji: string
  readonly keywords: readonly string[]
}

export type EmojiCategory = {
  readonly name: string
  readonly entries: readonly EmojiEntry[]
}

export const EMOJI_CATEGORIES: readonly EmojiCategory[] = [
  {
    name: 'Smileys',
    entries: [
      { emoji: '😀', keywords: ['sorriso', 'feliz', 'alegre'] },
      { emoji: '😃', keywords: ['sorriso', 'feliz', 'animado'] },
      { emoji: '😄', keywords: ['sorriso', 'feliz', 'risada'] },
      { emoji: '😁', keywords: ['sorriso', 'dentes', 'feliz'] },
      { emoji: '😅', keywords: ['alivio', 'alívio', 'suor', 'nervoso'] },
      { emoji: '😂', keywords: ['risada', 'chorando', 'engracado', 'engraçado'] },
      { emoji: '🤣', keywords: ['risada', 'rolando', 'engracado', 'engraçado'] },
      { emoji: '😊', keywords: ['sorriso', 'timido', 'tímido', 'feliz'] },
      { emoji: '😇', keywords: ['anjo', 'inocente', 'santo'] },
      { emoji: '🙂', keywords: ['sorriso', 'leve', 'ok'] },
      { emoji: '😉', keywords: ['piscada', 'piscar', 'flerte'] },
      { emoji: '😌', keywords: ['aliviado', 'calmo', 'tranquilo'] },
      { emoji: '😍', keywords: ['amor', 'apaixonado', 'coracao', 'coração', 'olhos'] },
      { emoji: '🥰', keywords: ['amor', 'apaixonado', 'carinho'] },
      { emoji: '😘', keywords: ['beijo', 'amor', 'carinho'] },
      { emoji: '😋', keywords: ['gostoso', 'delicia', 'delícia', 'lingua', 'língua'] },
      { emoji: '😜', keywords: ['lingua', 'língua', 'brincadeira', 'piscada'] },
      { emoji: '🤪', keywords: ['maluco', 'doido', 'brincadeira'] },
      { emoji: '🤔', keywords: ['pensando', 'duvida', 'dúvida', 'hmm'] },
      { emoji: '🤗', keywords: ['abraco', 'abraço', 'carinho'] },
      { emoji: '😐', keywords: ['neutro', 'serio', 'sério', 'indiferente'] },
      { emoji: '😴', keywords: ['dormindo', 'sono', 'cansado'] },
      { emoji: '😭', keywords: ['chorando', 'triste', 'lagrima', 'lágrima'] },
      { emoji: '😢', keywords: ['triste', 'chorando', 'lagrima', 'lágrima'] },
      { emoji: '😡', keywords: ['raiva', 'bravo', 'irritado'] },
      { emoji: '😱', keywords: ['susto', 'medo', 'assustado'] },
      { emoji: '🤯', keywords: ['explodindo', 'chocado', 'surpresa'] },
      { emoji: '😎', keywords: ['oculos', 'óculos', 'legal', 'estiloso'] },
      { emoji: '🥳', keywords: ['festa', 'comemorar', 'aniversario', 'aniversário'] },
      { emoji: '😷', keywords: ['mascara', 'máscara', 'doente', 'saude', 'saúde'] },
    ],
  },
  {
    name: 'Gestos',
    entries: [
      { emoji: '👍', keywords: ['joia', 'jóia', 'polegar', 'ok', 'positivo', 'curtir'] },
      { emoji: '👎', keywords: ['polegar', 'negativo', 'ruim', 'nao', 'não'] },
      { emoji: '👌', keywords: ['ok', 'certo', 'perfeito'] },
      { emoji: '✌️', keywords: ['paz', 'vitoria', 'vitória', 'dois'] },
      { emoji: '🤞', keywords: ['sorte', 'dedos', 'cruzados', 'torcendo'] },
      { emoji: '🤙', keywords: ['chama', 'ligar', 'shaka'] },
      { emoji: '👋', keywords: ['tchau', 'ola', 'olá', 'aceno', 'oi'] },
      { emoji: '✋', keywords: ['mao', 'mão', 'parar', 'pare'] },
      { emoji: '👏', keywords: ['palmas', 'aplauso', 'parabens', 'parabéns'] },
      { emoji: '🙌', keywords: ['comemorar', 'maos', 'mãos', 'sucesso'] },
      { emoji: '🤝', keywords: ['acordo', 'aperto', 'mao', 'mão', 'negocio', 'negócio', 'parceria'] },
      { emoji: '🙏', keywords: ['obrigado', 'reza', 'oracao', 'oração', 'por favor'] },
      { emoji: '✍️', keywords: ['escrever', 'assinar', 'assinatura'] },
      { emoji: '💪', keywords: ['forca', 'força', 'musculo', 'músculo', 'braco', 'braço'] },
      { emoji: '👇', keywords: ['abaixo', 'baixo', 'apontar', 'seta'] },
      { emoji: '👉', keywords: ['direita', 'apontar', 'seta'] },
      { emoji: '☝️', keywords: ['acima', 'cima', 'apontar', 'atencao', 'atenção'] },
    ],
  },
  {
    name: 'Corações',
    entries: [
      { emoji: '❤️', keywords: ['coracao', 'coração', 'amor', 'vermelho'] },
      { emoji: '🧡', keywords: ['coracao', 'coração', 'laranja'] },
      { emoji: '💛', keywords: ['coracao', 'coração', 'amarelo'] },
      { emoji: '💚', keywords: ['coracao', 'coração', 'verde'] },
      { emoji: '💙', keywords: ['coracao', 'coração', 'azul'] },
      { emoji: '💜', keywords: ['coracao', 'coração', 'roxo'] },
      { emoji: '🖤', keywords: ['coracao', 'coração', 'preto'] },
      { emoji: '🤍', keywords: ['coracao', 'coração', 'branco'] },
      { emoji: '💔', keywords: ['coracao', 'coração', 'partido', 'triste'] },
      { emoji: '💕', keywords: ['coracao', 'coração', 'amor', 'casal'] },
      { emoji: '💖', keywords: ['coracao', 'coração', 'brilho', 'amor'] },
      { emoji: '💝', keywords: ['coracao', 'coração', 'presente', 'laco', 'laço'] },
    ],
  },
  {
    name: 'Negócios',
    entries: [
      { emoji: '🏠', keywords: ['casa', 'imovel', 'imóvel', 'residencia', 'residência', 'moradia'] },
      { emoji: '🏡', keywords: ['casa', 'imovel', 'imóvel', 'jardim', 'moradia'] },
      { emoji: '🏢', keywords: ['predio', 'prédio', 'empresa', 'escritorio', 'escritório'] },
      { emoji: '🏦', keywords: ['banco', 'financiamento', 'agencia', 'agência'] },
      { emoji: '🔑', keywords: ['chave', 'casa', 'entrega', 'imovel', 'imóvel'] },
      { emoji: '📄', keywords: ['documento', 'papel', 'contrato', 'arquivo'] },
      { emoji: '📋', keywords: ['prancheta', 'lista', 'documento', 'checklist'] },
      { emoji: '📝', keywords: ['anotar', 'escrever', 'nota', 'formulario', 'formulário'] },
      { emoji: '✅', keywords: ['ok', 'certo', 'aprovado', 'concluido', 'concluído', 'check'] },
      { emoji: '❌', keywords: ['errado', 'negado', 'recusado', 'cancelar'] },
      { emoji: '⚠️', keywords: ['atencao', 'atenção', 'alerta', 'cuidado'] },
      { emoji: '💰', keywords: ['dinheiro', 'valor', 'saco', 'grana', 'pagamento'] },
      { emoji: '💵', keywords: ['dinheiro', 'nota', 'valor', 'pagamento'] },
      { emoji: '💳', keywords: ['cartao', 'cartão', 'credito', 'crédito', 'pagamento'] },
      { emoji: '🧾', keywords: ['recibo', 'nota', 'fiscal', 'comprovante'] },
      { emoji: '📊', keywords: ['grafico', 'gráfico', 'relatorio', 'relatório', 'dados'] },
      { emoji: '📈', keywords: ['grafico', 'gráfico', 'subindo', 'crescimento', 'alta'] },
      { emoji: '📉', keywords: ['grafico', 'gráfico', 'caindo', 'queda', 'baixa'] },
      { emoji: '🗓️', keywords: ['calendario', 'calendário', 'data', 'agenda', 'prazo'] },
      { emoji: '⏰', keywords: ['relogio', 'relógio', 'hora', 'prazo', 'alarme'] },
      { emoji: '📞', keywords: ['telefone', 'ligar', 'contato', 'chamada'] },
      { emoji: '📱', keywords: ['celular', 'telefone', 'whatsapp', 'contato'] },
      { emoji: '📧', keywords: ['email', 'e-mail', 'mensagem', 'contato'] },
      { emoji: '📎', keywords: ['anexo', 'clipe', 'arquivo'] },
      { emoji: '🔍', keywords: ['buscar', 'procurar', 'lupa', 'pesquisa', 'consulta'] },
      { emoji: '🤖', keywords: ['robo', 'robô', 'bot', 'assistente', 'automatico', 'automático'] },
      { emoji: '💬', keywords: ['mensagem', 'conversa', 'balao', 'balão', 'chat'] },
    ],
  },
  {
    name: 'Objetos',
    entries: [
      { emoji: '🎁', keywords: ['presente', 'brinde', 'surpresa'] },
      { emoji: '🎉', keywords: ['festa', 'comemorar', 'parabens', 'parabéns'] },
      { emoji: '🎊', keywords: ['festa', 'confete', 'comemorar'] },
      { emoji: '🎂', keywords: ['bolo', 'aniversario', 'aniversário', 'festa'] },
      { emoji: '💡', keywords: ['ideia', 'ideía', 'lampada', 'lâmpada', 'dica'] },
      { emoji: '🔔', keywords: ['sino', 'aviso', 'notificacao', 'notificação', 'lembrete'] },
      { emoji: '⭐', keywords: ['estrela', 'favorito', 'avaliacao', 'avaliação'] },
      { emoji: '🔥', keywords: ['fogo', 'quente', 'destaque', 'top'] },
      { emoji: '🚀', keywords: ['foguete', 'rapido', 'rápido', 'lancamento', 'lançamento'] },
      { emoji: '💻', keywords: ['computador', 'notebook', 'trabalho'] },
      { emoji: '📷', keywords: ['foto', 'camera', 'câmera', 'imagem'] },
      { emoji: '🚗', keywords: ['carro', 'veiculo', 'veículo', 'automovel', 'automóvel'] },
      { emoji: '✈️', keywords: ['aviao', 'avião', 'viagem', 'voo'] },
    ],
  },
  {
    name: 'Comida',
    entries: [
      { emoji: '🍔', keywords: ['hamburguer', 'hambúrguer', 'lanche', 'comida'] },
      { emoji: '🍕', keywords: ['pizza', 'comida', 'lanche'] },
      { emoji: '🍟', keywords: ['batata', 'frita', 'lanche'] },
      { emoji: '🍿', keywords: ['pipoca', 'cinema', 'filme'] },
      { emoji: '🍞', keywords: ['pao', 'pão', 'padaria'] },
      { emoji: '🧀', keywords: ['queijo', 'comida'] },
      { emoji: '🥗', keywords: ['salada', 'saudavel', 'saudável', 'comida'] },
      { emoji: '☕', keywords: ['cafe', 'café', 'bebida', 'quente'] },
      { emoji: '🍺', keywords: ['cerveja', 'bebida', 'chopp'] },
      { emoji: '🍷', keywords: ['vinho', 'bebida', 'taca', 'taça'] },
      { emoji: '🥂', keywords: ['brinde', 'comemorar', 'champanhe'] },
      { emoji: '🥤', keywords: ['refrigerante', 'bebida', 'copo'] },
    ],
  },
] as const

/**
 * Índice achatado: a busca ignora categoria, porque quem digita "casa" quer o resultado venha de
 * onde vier. A ordem preserva a das categorias, então o resultado sai agrupado por afinidade sem
 * precisar ordenar.
 */
const ALL_ENTRIES: readonly EmojiEntry[] = EMOJI_CATEGORIES.flatMap((category) => category.entries)

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
}

/**
 * Busca por prefixo de palavra-chave, não por substring: "ca" traz "casa" e "cartão", mas "sa" não
 * traz "casa" — casar no meio da palavra devolvia resultado que ninguém consegue explicar.
 */
export function searchEmojis(query: string): readonly EmojiEntry[] {
  const term = normalize(query)
  if (!term) return ALL_ENTRIES

  return ALL_ENTRIES.filter((entry) => entry.keywords.some((keyword) => normalize(keyword).startsWith(term)))
}
