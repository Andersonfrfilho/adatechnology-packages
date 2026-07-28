import {
  FileArchive,
  FileAudio,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileVideo,
  File as FileGeneric,
  Presentation,
} from 'lucide-react'

import { cn } from './lib/cn'

export interface FileIconProps {
  filename?: string
  mimeType?: string
  size?: number
  className?: string
}

type IconStyle = { Icon: typeof FileText; colorClass: string }

// Um estilo por família, reaproveitado por todas as extensões dela: assim o ícone de um `.jpg`
// resolvido pelo nome é o mesmo de um `image/jpeg` resolvido pelo mimeType. Com cor por extensão, a
// mesma foto trocaria de cor conforme o dado que chegou junto.
const IMAGE_STYLE: IconStyle = { Icon: FileImage, colorClass: 'text-violet-500' }
const VIDEO_STYLE: IconStyle = { Icon: FileVideo, colorClass: 'text-fuchsia-500' }
const AUDIO_STYLE: IconStyle = { Icon: FileAudio, colorClass: 'text-amber-500' }
const SHEET_STYLE: IconStyle = { Icon: FileSpreadsheet, colorClass: 'text-green-600' }
const WORD_STYLE: IconStyle = { Icon: FileText, colorClass: 'text-blue-500' }
const SLIDES_STYLE: IconStyle = { Icon: Presentation, colorClass: 'text-orange-600' }
const TEXT_STYLE: IconStyle = { Icon: FileText, colorClass: 'text-gray-500' }

const EXTENSION_STYLE: Record<string, IconStyle> = {
  pdf: { Icon: FileText, colorClass: 'text-red-500' },
  doc: WORD_STYLE,
  docx: WORD_STYLE,
  xls: SHEET_STYLE,
  xlsx: SHEET_STYLE,
  csv: SHEET_STYLE,
  ppt: SLIDES_STYLE,
  pptx: SLIDES_STYLE,
  zip: { Icon: FileArchive, colorClass: 'text-orange-500' },
  txt: TEXT_STYLE,
  plain: TEXT_STYLE,

  image: IMAGE_STYLE,
  jpg: IMAGE_STYLE,
  jpeg: IMAGE_STYLE,
  png: IMAGE_STYLE,
  webp: IMAGE_STYLE,
  gif: IMAGE_STYLE,
  heic: IMAGE_STYLE,

  video: VIDEO_STYLE,
  mp4: VIDEO_STYLE,
  '3gp': VIDEO_STYLE,
  '3gpp': VIDEO_STYLE,
  mov: VIDEO_STYLE,
  webm: VIDEO_STYLE,

  audio: AUDIO_STYLE,
  mp3: AUDIO_STYLE,
  mpeg: AUDIO_STYLE,
  ogg: AUDIO_STYLE,
  oga: AUDIO_STYLE,
  opus: AUDIO_STYLE,
  aac: AUDIO_STYLE,
  amr: AUDIO_STYLE,
  m4a: AUDIO_STYLE,
  wav: AUDIO_STYLE,
}

const MEDIA_FAMILIES = new Set(['image', 'video', 'audio'])

/**
 * A chave de estilo do arquivo, na ordem em que cada dado é confiável.
 *
 * 1. **extensão do nome** — o mimeType do Office é longo (`…wordprocessingml.document`) e nunca
 *    casaria, então quem olhasse só o mimeType perderia o ícone de Word e de Excel;
 * 2. **família do mimeType** (`image/`, `video/`, `audio/`) — tem de vir ANTES do subtipo por causa
 *    de `audio/mp4`: pelo subtipo, um áudio m4a ganharia o ícone de vídeo;
 * 3. **subtipo** — cobre `application/pdf` e `application/zip`, que chegam sem nome de arquivo.
 *
 * Áudio de WhatsApp chega como `audio/ogg; codecs=opus`; o parâmetro depois do `;` é descartado,
 * senão o subtipo viria `ogg; codecs=opus` e não casaria nada.
 *
 * Exportada para teste: é a regra que já regrediu uma vez no painel de documentos.
 */
export function resolveFileIconExtension(filename?: string, mimeType?: string): string {
  const fromFilename = filename?.split('.').pop()?.toLowerCase()
  if (fromFilename && EXTENSION_STYLE[fromFilename]) return fromFilename

  const [family, subtype] = (mimeType ?? '').split(';')[0]!.toLowerCase().split('/')
  if (family && MEDIA_FAMILIES.has(family)) return family

  return subtype ?? ''
}

// Melhoria sobre a paridade da bolha de documento (T6.7 usava um único ícone genérico
// para qualquer tipo de arquivo) — ícone e cor variam por extensão/mimeType.
export function FileIcon({ filename, mimeType, size = 20, className }: FileIconProps) {
  const extension = resolveFileIconExtension(filename, mimeType)
  const style = EXTENSION_STYLE[extension] ?? { Icon: FileGeneric, colorClass: 'text-gray-500' }
  const { Icon, colorClass } = style

  // `cn` em vez de concatenar: a cor por extensão é a base, e produto que passa `text-*` precisa
  // ganhar dela — concatenado, quem vence é a ordem no CSS gerado, não a intenção de quem chamou.
  return <Icon size={size} className={cn(colorClass, className)} />
}
