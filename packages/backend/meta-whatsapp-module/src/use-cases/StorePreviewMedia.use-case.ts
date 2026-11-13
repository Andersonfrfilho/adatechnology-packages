import type { ObjectStorageInterface } from '@adatechnology/meta-whatsapp-contracts'
import { toPreviewMediaId } from '../channel/previewMedia'

/**
 * Guarda um arquivo gravado no simulador e devolve o id que o webhook vai referenciar.
 *
 * Existe como use-case para o host só precisar da ROTA: receber o corpo, chamar isto, devolver o
 * `mediaId`. A parte que erra — onde gravar, com que chave, como marcar o id para o adaptador
 * reconhecer depois — fica aqui, num lugar só, e não em cada produto.
 *
 * O SDK para exatamente na porta do HTTP: registrar endpoint é do host, e um pacote que abrisse rota
 * no servidor de quem o instala decidiria caminho, autenticação e versionamento no lugar dele.
 */
export type StorePreviewMediaParams = {
  companyId: string
  /** Bytes do arquivo. Quem converte de base64 é a rota — o use-case não conhece transporte. */
  buffer: Buffer
  mimeType: string
  filename?: string
}

export type StorePreviewMediaResult = {
  /** Já com o prefixo: é isto que o simulador manda no webhook. */
  mediaId: string
  uploadId: string
}

export class StorePreviewMediaUseCase {
  constructor(
    private readonly objectStorage: ObjectStorageInterface,
    /**
     * Fonte do sufixo único da chave. Injetada porque o módulo não escolhe gerador de id — e porque
     * um teste precisa de chave previsível.
     */
    private readonly generateKeySuffix: () => string,
  ) {}

  async execute(params: StorePreviewMediaParams): Promise<StorePreviewMediaResult> {
    /**
     * Namespace próprio (`preview/`) e não junto da mídia real.
     *
     * Arquivo de simulação e arquivo de cliente têm ciclo de vida diferente: a retenção varre a
     * biblioteca da conversa, e misturar os dois faria a limpeza pensar duas vezes sobre o que é
     * dado de verdade. Separado, apagar tudo que é teste é apagar um prefixo.
     */
    const key = `meta-whatsapp/${params.companyId}/preview/${this.generateKeySuffix()}`

    const { uploadId } = await this.objectStorage.upload({
      buffer: params.buffer,
      mimeType: params.mimeType,
      key,
    })

    return { mediaId: toPreviewMediaId(uploadId), uploadId }
  }
}
