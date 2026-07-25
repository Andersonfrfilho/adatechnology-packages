import { FileArchive, FileSpreadsheet, FileText, File as FileGeneric } from 'lucide-react'

export interface FileIconProps {
  filename?: string
  mimeType?: string
  size?: number
  className?: string
}

const EXTENSION_STYLE: Record<string, { Icon: typeof FileText; colorClass: string }> = {
  pdf: { Icon: FileText, colorClass: 'text-red-500' },
  doc: { Icon: FileText, colorClass: 'text-blue-500' },
  docx: { Icon: FileText, colorClass: 'text-blue-500' },
  xls: { Icon: FileSpreadsheet, colorClass: 'text-green-600' },
  xlsx: { Icon: FileSpreadsheet, colorClass: 'text-green-600' },
  zip: { Icon: FileArchive, colorClass: 'text-orange-500' },
}

function getExtension(filename?: string, mimeType?: string): string {
  const fromFilename = filename?.split('.').pop()?.toLowerCase()
  if (fromFilename && EXTENSION_STYLE[fromFilename]) return fromFilename
  return mimeType?.split('/')[1]?.toLowerCase() ?? ''
}

// Melhoria sobre a paridade da bolha de documento (T6.7 usava um único ícone genérico
// para qualquer tipo de arquivo) — ícone e cor variam por extensão/mimeType.
export function FileIcon({ filename, mimeType, size = 20, className = '' }: FileIconProps) {
  const extension = getExtension(filename, mimeType)
  const style = EXTENSION_STYLE[extension] ?? { Icon: FileGeneric, colorClass: 'text-gray-500' }
  const { Icon, colorClass } = style

  return <Icon size={size} className={`${colorClass} ${className}`.trim()} />
}
