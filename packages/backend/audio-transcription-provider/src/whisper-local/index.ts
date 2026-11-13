/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Entrada opt-in do engine local. Separada do barril principal para que quem usa só o engine
 * hospedado não arraste `node:child_process` nem a exigência de ffmpeg/whisper.cpp na imagem.
 */

export { createWhisperLocalTranscriber } from './whisper-local.service'
