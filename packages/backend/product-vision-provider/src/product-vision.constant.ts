/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

/**
 * CLIP ViT-B/32: 512 dimensoes, ~90MB em ONNX quantizado. E a dimensao que o
 * `@adatechnology/catalog-module` indexa, e trocar o modelo sem reindexar e recusado no boot de la.
 */
export const CLIP_DEFAULT_MODEL = 'Xenova/clip-vit-base-patch32'
export const CLIP_DEFAULT_DIMENSIONS = 512
export const CLIP_DEFAULT_TIMEOUT_MS = 30_000

/**
 * So os formatos lineares de produto. QR Code fica de fora de proposito: gondola tem QR de
 * promocao colado do lado do preco, e o cliente fotografa a prateleira inteira — decodificar esse
 * QR viraria "codigo do produto" com a confianca de um GTIN.
 *
 * Os nomes sao os que o zbar devolve em `symbol.typeName`, verificados contra a biblioteca real.
 * Nomes "bonitos" como `EAN-13` nao casam com nada, e o efeito e a leitura sempre voltar vazia —
 * sem erro, sem log, so o cliente ouvindo "nao identifiquei" para toda foto.
 */
export const BARCODE_DEFAULT_FORMATS = [
  'ZBAR_EAN13',
  'ZBAR_EAN8',
  'ZBAR_UPCA',
  'ZBAR_UPCE',
  'ZBAR_ISBN13',
  'ZBAR_I25',
  'ZBAR_CODE128',
  'ZBAR_CODE39',
  'ZBAR_DATABAR',
] as const

/** ~2MP: o suficiente para um EAN de embalagem, e o que impede uma foto de 12MP prender o worker. */
export const BARCODE_DEFAULT_MAX_PIXELS = 2_000_000

export const SUPPORTED_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const

export function normalizeMimeType(value: string): string {
  return (value.split(';')[0] ?? '').trim().toLowerCase()
}

export function isSupportedImageMimeType(value: string): boolean {
  return (SUPPORTED_IMAGE_MIME_TYPES as readonly string[]).includes(normalizeMimeType(value))
}

/**
 * Desempate por modelo de visao, servido por um Ollama local.
 *
 * `qwen2.5vl:3b` (~3.2GB) e o default por ter sido o que respondeu. O `moondream`, menor e a
 * escolha obvia pelo tamanho, devolve string VAZIA no Ollama 0.32 — ate com prompt so de texto —
 * e o sintoma e indistinguivel de "o modelo nao soube responder".
 */
export const OLLAMA_DEFAULT_BASE_URL = 'http://localhost:11434'
export const OLLAMA_DEFAULT_MODEL = 'qwen2.5vl:3b'
/**
 * Medido em CPU (Apple Silicon, qwen2.5vl:3b): 5s a 15s por desempate.
 *
 * Isso e MUITO para uma conversa: o cliente manda a foto e fica olhando o "digitando". O teto e
 * generoso de proposito — estourar devolve os candidatos para a pessoa escolher, que e pior que
 * responder certo e melhor que nao responder — mas o numero em si e o argumento mais forte para
 * ligar o desempate so quando a metrica do vetorial mostrar que vale.
 */
export const OLLAMA_DEFAULT_TIMEOUT_MS = 30_000
/**
 * Quanto o Ollama mantem o modelo na memoria depois de responder.
 *
 * Medido: com o modelo frio a primeira resposta leva ~16s; quente, ~4s. Como o desempate e
 * esporadico por natureza, o default do Ollama (5 minutos) faz quase toda foto pagar o
 * carregamento — e o cliente que espera 16s ja desistiu.
 */
export const OLLAMA_DEFAULT_KEEP_ALIVE = '30m'
/**
 * Teto de largura da imagem enviada ao modelo.
 *
 * Medido com qwen2.5vl:3b: 1280px custa 1632 tokens de visao e ~6,6s; 896px cai para 1104 tokens e
 * ~4,2s. Abaixo de 896px NAO adianta — o modelo ja normaliza para o mesmo numero de tokens, e 224px
 * leva o mesmo tempo que 640px.
 *
 * O piso de ~4s e do modelo nesta classe de maquina; para ir abaixo disso e preciso GPU, modelo
 * menor, ou nao chamar o desempate.
 */
export const OLLAMA_DEFAULT_MAX_IMAGE_WIDTH = 896
