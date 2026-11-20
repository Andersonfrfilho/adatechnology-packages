/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Reexporta o adaptador WHATWG do `@adatechnology/module-http`, para o host importar
 * `@adatechnology/expense-module/http/fetch` sem saber que o encanamento é compartilhado.
 */
export { createModuleFetchRouter, toFetchResponse } from '@adatechnology/module-http/fetch'
export type { ModuleFetchRouter, CreateModuleFetchRouterParams } from '@adatechnology/module-http/fetch'
