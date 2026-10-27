/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * A raiz do pacote nao carrega engine nenhum: tipos, cadeia, erros e constantes, sem dependencia.
 * Os engines vivem em subpath (`./barcode`, `./clip-local`) porque cada um traz um runtime pesado,
 * e quem so quer ler codigo de barras nao deve baixar ONNX junto.
 */

export { createVisionChain } from './vision-chain.service'
export type { VisionChainConfig } from './vision-chain.service'

export {
  BARCODE_DEFAULT_FORMATS,
  BARCODE_DEFAULT_MAX_PIXELS,
  CLIP_DEFAULT_DIMENSIONS,
  CLIP_DEFAULT_MODEL,
  CLIP_DEFAULT_TIMEOUT_MS,
  SUPPORTED_IMAGE_MIME_TYPES,
  isSupportedImageMimeType,
  normalizeMimeType,
} from './product-vision.constant'

export { VisionError, VisionEngineUnavailableError, isVisionError } from './product-vision.error'

export type {
  BarcodeReaderConfig,
  ClipEmbedderConfig,
  ProductVisionEngine,
  VisionInput,
  VisionReading,
} from './product-vision.types'
