/**
 * A convenção de mídia do simulador mora em `@adatechnology/meta-whatsapp-contracts`.
 *
 * Reexportada aqui só por conveniência de quem já importa do módulo. A definição NÃO é duplicada de
 * propósito: o front também precisa dela, e foi justamente uma cópia de cada lado — com comentários
 * pedindo "precisa bater com a outra" — que fez o recurso existir num produto e faltar no outro.
 */

export {
  PREVIEW_MEDIA_ID_PREFIX,
  toPreviewMediaId,
  resolvePreviewUploadId,
} from '@adatechnology/meta-whatsapp-contracts'
