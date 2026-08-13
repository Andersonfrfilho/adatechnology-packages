/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Recorte de fundo da foto do produto, no navegador.
 *
 * Roda U²-Net (Apache-2.0) sobre `onnxruntime-web` (MIT). As bibliotecas prontas de recorte que
 * embrulhariam isto em três linhas são AGPL, e o modelo popular do ramo (RMBG) é não-comercial —
 * nenhum dos dois serve a um painel proprietário. Daí o pré e pós-processamento explícito aqui.
 *
 * O modelo **não vem no pacote**: o host informa a URL de onde ele é servido. São ~4,7MB, que não
 * cabem num npm install de quem nem usa o recurso, e servir do próprio domínio mantém a foto e o
 * CSP dentro de casa.
 */

const MODEL_INPUT_EDGE = 320

/** Normalização com que o U²-Net foi treinado (ImageNet). Trocar isto degrada a máscara em silêncio. */
const CHANNEL_MEAN = [0.485, 0.456, 0.406] as const
const CHANNEL_STD = [0.229, 0.224, 0.225] as const

/** A saída é usada como transparência, então WebP: preserva alfa e pesa uma fração do PNG. */
const OUTPUT_TYPE = 'image/webp'
const OUTPUT_QUALITY = 0.92

/** Teto do lado maior do resultado, o mesmo da compressão: a imagem vive numa bolha de conversa. */
const OUTPUT_MAX_EDGE = 1600

export const BACKGROUND_FILL = {
  /** Padrão para catálogo: produto escuro sobre transparência some no tema escuro do WhatsApp. */
  WHITE: 'white',
  TRANSPARENT: 'transparent',
} as const
export type BackgroundFill = (typeof BACKGROUND_FILL)[keyof typeof BACKGROUND_FILL]

export type BackgroundRemovalConfig = {
  /** URL do `u2netp.onnx` (ou `u2net.onnx`) servido pelo host. Sem ela o recurso não existe. */
  readonly modelUrl: string
  /**
   * URL do bundle do onnxruntime-web (`ort.wasm.min.js`), servido pelo host.
   *
   * Carregado por `<script>`, e não por `import()`, de propósito: o runtime importa o próprio loader
   * `.mjs` em tempo de execução, e todo bundler reescreve esse import do seu jeito — o Vite chega a
   * recusar o arquivo por estar em `public/`. Por fora do grafo de módulos isso simplesmente não
   * acontece, e o pacote deixa de ter dependência de runtime.
   */
  readonly runtimeUrl: string
  /** Pasta dos `.wasm`. Ausente, a lib os procura ao lado do próprio bundle, que costuma bastar. */
  readonly wasmPaths?: string
}

export type RemoveBackgroundParams = {
  readonly file: File
  readonly config: BackgroundRemovalConfig
  readonly fill?: BackgroundFill
}

/**
 * A sessão guarda os ~4,7MB de pesos já compilados: recriar a cada clique baixaria o modelo de novo.
 * A promessa é memoizada, e não o resultado, para dois cliques rápidos não abrirem duas sessões.
 */
const sessionByModelUrl = new Map<string, Promise<OnnxSession>>()

export async function removeBackground({
  file,
  config,
  fill = BACKGROUND_FILL.WHITE,
}: RemoveBackgroundParams): Promise<File> {
  const bitmap = await createImageBitmap(file)

  try {
    const runtime = await loadRuntime(config)
    const session = await loadSession(config)
    const mask = await inferMask({ bitmap, session, runtime })
    const blob = await composite({ bitmap, mask, fill })

    return new File([blob], toWebpName(file.name), { type: OUTPUT_TYPE })
  } finally {
    bitmap.close()
  }
}

type OnnxSession = {
  readonly inputNames: readonly string[]
  readonly outputNames: readonly string[]
  run(feeds: Record<string, unknown>): Promise<Record<string, { readonly data: Float32Array }>>
}

type OnnxRuntime = {
  readonly env: { readonly wasm: { wasmPaths?: string } }
  readonly Tensor: new (type: string, data: Float32Array, dims: readonly number[]) => unknown
  readonly InferenceSession: {
    create(modelUrl: string, options: { executionProviders: readonly string[] }): Promise<OnnxSession>
  }
}

async function loadSession(config: BackgroundRemovalConfig): Promise<OnnxSession> {
  const cached = sessionByModelUrl.get(config.modelUrl)
  if (cached) return cached

  // O runtime e os pesos só são baixados por quem clica em remover fundo.
  const pending = loadRuntime(config).then((onnx) => {
    if (config.wasmPaths) onnx.env.wasm.wasmPaths = config.wasmPaths

    return onnx.InferenceSession.create(config.modelUrl, { executionProviders: ['wasm'] })
  })

  sessionByModelUrl.set(config.modelUrl, pending)

  try {
    return await pending
  } catch (error) {
    // Sessão que falhou não pode ficar em cache, ou o segundo clique repete o erro sem tentar.
    sessionByModelUrl.delete(config.modelUrl)
    throw error
  }
}

/** O bundle publica `window.ort`. Um `<script>` por URL: o segundo clique reusa o que já carregou. */
const runtimeByUrl = new Map<string, Promise<OnnxRuntime>>()

function loadRuntime(config: BackgroundRemovalConfig): Promise<OnnxRuntime> {
  const existing = runtimeByUrl.get(config.runtimeUrl)
  if (existing) return existing

  const pending = new Promise<OnnxRuntime>((resolve, reject) => {
    const globalRuntime = (globalThis as { ort?: OnnxRuntime }).ort
    if (globalRuntime) {
      resolve(globalRuntime)
      return
    }

    const script = document.createElement('script')
    script.src = config.runtimeUrl
    script.async = true
    script.onload = () => {
      const loaded = (globalThis as { ort?: OnnxRuntime }).ort
      if (loaded) resolve(loaded)
      else reject(new Error('Runtime de recorte carregou sem publicar `ort`'))
    }
    script.onerror = () => reject(new Error('Falha ao carregar o runtime de recorte'))

    document.head.appendChild(script)
  })

  runtimeByUrl.set(config.runtimeUrl, pending)

  return pending.catch((error: unknown) => {
    runtimeByUrl.delete(config.runtimeUrl)
    throw error
  })
}

type InferMaskParams = {
  readonly bitmap: ImageBitmap
  readonly session: OnnxSession
  readonly runtime: OnnxRuntime
}

async function inferMask({ bitmap, session, runtime }: InferMaskParams): Promise<Float32Array> {
  const pixels = drawToImageData(bitmap, { width: MODEL_INPUT_EDGE, height: MODEL_INPUT_EDGE })
  const input = toNormalizedTensor(pixels)

  const inputName = session.inputNames[0]
  const outputName = session.outputNames[0]
  if (!inputName || !outputName) throw new Error('Modelo de recorte sem entrada ou saída declarada')

  const output = await session.run({
    [inputName]: new runtime.Tensor('float32', input, [1, 3, MODEL_INPUT_EDGE, MODEL_INPUT_EDGE]),
  })

  const mask = output[outputName]?.data
  if (!mask) throw new Error('Modelo de recorte não devolveu máscara')

  return normalizeMask(mask)
}

function toNormalizedTensor(pixels: ImageData): Float32Array {
  const pixelCount = MODEL_INPUT_EDGE * MODEL_INPUT_EDGE
  const tensor = new Float32Array(pixelCount * 3)

  for (let index = 0; index < pixelCount; index += 1) {
    for (let channel = 0; channel < 3; channel += 1) {
      const value = (pixels.data[index * 4 + channel] ?? 0) / 255
      tensor[channel * pixelCount + index] = (value - CHANNEL_MEAN[channel]!) / CHANNEL_STD[channel]!
    }
  }

  return tensor
}

/** O U²-Net devolve escala arbitrária; sem esticar min–max a máscara sai cinza e lavada. */
function normalizeMask(mask: Float32Array): Float32Array {
  let min = Infinity
  let max = -Infinity

  for (const value of mask) {
    if (value < min) min = value
    if (value > max) max = value
  }

  const range = max - min
  if (range <= 0) return mask

  const normalized = new Float32Array(mask.length)
  for (let index = 0; index < mask.length; index += 1) {
    normalized[index] = (mask[index]! - min) / range
  }

  return normalized
}

type CompositeParams = {
  readonly bitmap: ImageBitmap
  readonly mask: Float32Array
  readonly fill: BackgroundFill
}

async function composite({ bitmap, mask, fill }: CompositeParams): Promise<Blob> {
  const size = resolveOutputSize(bitmap)
  const canvas = createCanvas(size)
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Navegador sem canvas 2D')

  context.drawImage(bitmap, 0, 0, size.width, size.height)

  // A máscara sai em 320×320: o próprio canvas a estica para o tamanho final, com suavização.
  context.globalCompositeOperation = 'destination-in'
  context.drawImage(maskToCanvas(mask), 0, 0, size.width, size.height)

  if (fill === BACKGROUND_FILL.WHITE) {
    context.globalCompositeOperation = 'destination-over'
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, size.width, size.height)
  }

  context.globalCompositeOperation = 'source-over'

  return toBlob(canvas)
}

function maskToCanvas(mask: Float32Array): HTMLCanvasElement {
  const canvas = createCanvas({ width: MODEL_INPUT_EDGE, height: MODEL_INPUT_EDGE })
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Navegador sem canvas 2D')

  const image = context.createImageData(MODEL_INPUT_EDGE, MODEL_INPUT_EDGE)
  for (let index = 0; index < mask.length; index += 1) {
    image.data[index * 4 + 3] = Math.round((mask[index] ?? 0) * 255)
  }
  context.putImageData(image, 0, 0)

  return canvas
}

type Size = { readonly width: number; readonly height: number }

function resolveOutputSize(bitmap: ImageBitmap): Size {
  const longestEdge = Math.max(bitmap.width, bitmap.height)
  if (longestEdge <= OUTPUT_MAX_EDGE) return { width: bitmap.width, height: bitmap.height }

  const ratio = OUTPUT_MAX_EDGE / longestEdge

  return {
    width: Math.max(1, Math.round(bitmap.width * ratio)),
    height: Math.max(1, Math.round(bitmap.height * ratio)),
  }
}

function createCanvas({ width, height }: Size): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  return canvas
}

function drawToImageData(bitmap: ImageBitmap, size: Size): ImageData {
  const canvas = createCanvas(size)
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Navegador sem canvas 2D')

  context.drawImage(bitmap, 0, 0, size.width, size.height)

  return context.getImageData(0, 0, size.width, size.height)
}

async function toBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, OUTPUT_TYPE, OUTPUT_QUALITY)
  })
  if (!blob) throw new Error('Falha ao codificar a imagem recortada')

  return blob
}

export function toWebpName(name: string): string {
  const base = name.replace(/\.[^./\\]+$/, '')

  return `${base || 'imagem'}-sem-fundo.webp`
}
