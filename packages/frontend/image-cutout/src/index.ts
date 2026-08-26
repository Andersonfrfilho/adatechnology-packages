/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Recorte de fundo no navegador, compartilhado por quem sobe foto de produto e por quem sobe foto
 * de perfil.
 *
 * Vivia dentro de `products-ui`. Saiu de lá quando a foto de perfil precisou do mesmo recorte: a
 * alternativa era `user-ui` depender do pacote inteiro de catálogo — arrastando tabela de produto,
 * preço e sincronização com a Meta para dentro da tela de usuários — ou copiar o modelo, o
 * pré-processamento e o pós-processamento para um segundo lugar.
 */

export { removeBackground, toWebpName, BACKGROUND_FILL } from './removeBackground'
export type { BackgroundFill, BackgroundRemovalConfig, RemoveBackgroundParams } from './removeBackground'

export { useBackgroundRemoval } from './useBackgroundRemoval.hook'
export type { UseBackgroundRemovalParams, UseBackgroundRemovalResult } from './useBackgroundRemoval.hook'
