/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Seletor de arquivo estilizado: botão + nome do arquivo, com os textos vindos das mensagens (o
 * `<input type="file">` nativo mostra o idioma do navegador e não aceita estilo).
 */

import { ImageUp } from 'lucide-react'
import { useRef, useState } from 'react'

export type FilePickerProps = {
  readonly buttonLabel: string
  readonly emptyLabel: string
  readonly accept: string
  readonly isBusy?: boolean
  readonly onPick: (file: File) => void
}

export function FilePicker({ buttonLabel, emptyLabel, accept, isBusy = false, onPick }: FilePickerProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState('')

  return (
    <div className="adc-file-picker">
      <button type="button" className="adc-button" disabled={isBusy} onClick={() => inputRef.current?.click()}>
        <ImageUp aria-hidden="true" className="adc-icon" />
        {buttonLabel}
      </button>
      <span className="adc-file-name" aria-live="polite">
        {fileName || emptyLabel}
      </span>
      <input
        ref={inputRef}
        hidden
        type="file"
        accept={accept}
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (!file) return
          setFileName(file.name)
          onPick(file)
        }}
      />
    </div>
  )
}
