/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Reexporta o adaptador WHATWG do `@adatechnology/module-http`. Existe como entrypoint próprio
 * para o host importar `@adatechnology/scheduling-module/http/fetch` sem saber que o encanamento
 * é compartilhado — e para a troca do pacote base não virar breaking change no consumidor.
 */

export { createModuleFetchRouter, toFetchResponse } from '@adatechnology/module-http/fetch'
export type { ModuleFetchRouter, CreateModuleFetchRouterParams } from '@adatechnology/module-http/fetch'
