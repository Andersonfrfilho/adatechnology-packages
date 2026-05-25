import type { WinstonModuleConfig } from "./implementations/winston/winston.logger.types";
import { LoggerLevel } from "./logger.interface";
import type { TracingConfig } from "./tracing/tracing.config";
import type { RequestIdFormat } from "./request-id.constants";

export interface LoggerConfig extends WinstonModuleConfig {
  /**
   * Define se o provider do logger deve ser request-scoped
   */
  requestScoped?: boolean;

  /**
   * Nível de log padrão (string compatível com winston)
   */
  level?: LoggerLevel | string;

  /**
   * Contexto padrão para os logs
   */
  context?: string;

  /**
   * Define se o log deve ser formatado para produção (ex.: JSON)
   */
  isProduction?: boolean;

  /**
   * Define se deve colorir a saída (útil para desenvolvimento local)
   */
  colorize?: boolean;

  /**
   * Nome da aplicação para exibição nos logs
   */
  appName?: string;

  /**
   * Versão da aplicação para exibição nos logs
   */
  appVersion?: string;

  /**
   * Identificação da biblioteca/módulo que está gerando o log
   */
  lib?: string;

  /**
   * Versão da biblioteca/módulo que está gerando o log
   */
  libVersion?: string;

  /**
   * Rotas excluídas do HttpLoggingInterceptor (ex.: ['/health'])
   * Suporta prefixo exato ou parcial via startsWith
   */
  interceptorExcludedPaths?: string[];

  /**
   * Habilita rastreamento de stack de chamadas nos logs (default: false)
   */
  enableTraceStack?: boolean;

  /**
   * Configuração de file transport para os logs
   */
  fileTransport?: {
    enabled: boolean;
    dir?: string;
    filename?: string;
    maxSize?: string;
    maxFiles?: string;
  };

  /**
   * Formato do requestId gerado pelo RequestContextMiddleware quando não há header x-request-id.
   *
   * - 'short-hash' (padrão): 12 chars hex — ex: a1b2c3d4e5f6 (legível em Loki, correlaciona com Jaeger)
   * - 'uuid':                UUID completo — ex: 550e8400-e29b-41d4-a716-446655440000
   */
  requestIdFormat?: RequestIdFormat;

  /**
   * Configuração de tracing distribuído (OpenTelemetry).
   * Pode ser sobrescrita por env vars OTEL_* e TRACING_PROVIDER.
   */
  tracing?: TracingConfig;
}

export const DEFAULT_LOGGER_CONFIG: LoggerConfig = {
  requestScoped: false,
  level: "info",
  colorize: true,
};

export default DEFAULT_LOGGER_CONFIG;
