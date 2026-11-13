/**
 * Cliente do `hertzg/tesseract-server` self-hosted (Tesseract, sem chave de API) — `POST /tesseract`
 * espera `multipart/form-data` com `options` (JSON `{"languages":[...]}`) e `file`. Devolve
 * `{data: {exit: {code}, stdout, stderr}}`; `exit.code !== 0` é falha (formato não suportado, imagem
 * ilegível), tratada como "não deu para ler", nunca como upload inválido — o documento já foi salvo
 * antes desta chamada.
 *
 * ⚠️ Só lê imagem raster (PNG/JPEG): o build não tem suporte a PDF (`Pdf reading is not supported`,
 * confirmado contra o serviço de verdade). Quem chama decide o tipo antes — ver `readsWithOcr`.
 *
 * Spec 071: sobe para o pacote porque a API e o worker precisam do mesmo cliente, e nenhuma app
 * importa código-fonte de outra. ADR-0054 do `transportada`.
 */
const OCR_REQUEST_TIMEOUT_MS = 15_000
const OCR_LANGUAGES = ['por'] as const

const PDF_MIME_TYPE = 'application/pdf'

type TesseractServerResponse = Readonly<{
  data: Readonly<{
    exit: Readonly<{ code: number; signal: string | null }>
    stderr: string
    stdout: string
  }>
}>

export type OcrTextReader = Readonly<{
  extractText: (input: { readonly bytes: Uint8Array; readonly mimeType: string }) => Promise<string>
}>

/**
 * A escolha entre camada de texto e OCR é do **tipo do arquivo**, não do tipo do documento: PDF tem
 * camada de texto para tentar, imagem não tem. É a mesma regra que o gateway da API já aplicava, e
 * ela sobe junto para o worker não a redescobrir por conta própria.
 */
export function readsWithOcr(mimeType: string): boolean {
  return mimeType !== PDF_MIME_TYPE
}

export function createTesseractOcrClient(input: { readonly baseUrl: string }): OcrTextReader {
  return {
    async extractText({ bytes, mimeType }) {
      const form = new FormData()
      form.set('options', JSON.stringify({ languages: OCR_LANGUAGES }))
      form.set('file', new Blob([bytes as unknown as BlobPart], { type: mimeType }), 'document')

      const response = await fetch(`${input.baseUrl}/tesseract`, {
        body: form,
        method: 'POST',
        signal: AbortSignal.timeout(OCR_REQUEST_TIMEOUT_MS),
      })
      if (!response.ok) throw new Error(`tesseract request failed with status ${response.status}`)

      const result = (await response.json()) as TesseractServerResponse
      if (result.data.exit.code !== 0) {
        throw new Error(`tesseract could not read the file: ${result.data.stderr}`)
      }

      return result.data.stdout
    },
  }
}
