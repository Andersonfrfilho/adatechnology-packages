/**
 * Configuração centralizada de tracing distribuído.
 *
 * Todos os campos são opcionais — valores padrão são lidos das env vars
 * convencionais (OTEL_*, DD_*, GOOGLE_*) para compatibilidade out-of-the-box.
 *
 * Troca de provider em produção: basta alterar TRACING_PROVIDER no ConfigMap k8s.
 */
export interface TracingConfig {
  /**
   * Provider de tracing a usar.
   * Padrão: valor de TRACING_PROVIDER || 'opentelemetry'
   *
   * - 'opentelemetry' → Jaeger, Grafana Tempo, New Relic, qualquer coletor OTLP
   * - 'none'          → desabilita tracing completamente (zero overhead)
   */
  provider?: "opentelemetry" | "none";

  /**
   * Nome do serviço exibido no Jaeger/Grafana.
   * Padrão: OTEL_SERVICE_NAME || appName da LoggerConfig
   */
  serviceName?: string;

  /**
   * Versão do serviço. Padrão: npm_package_version
   */
  serviceVersion?: string;

  /**
   * Config do exportador OTLP (Jaeger, Grafana Tempo, New Relic, Datadog OTLP, etc.)
   */
  otlp?: {
    /**
     * Endpoint do coletor.
     * Padrão: OTEL_EXPORTER_OTLP_ENDPOINT || 'http://jaeger:4318'
     *
     * Migração para nuvem — só muda o endpoint no ConfigMap:
     *   Grafana Cloud:  'https://<id>.otlp.grafana.net'
     *   New Relic:      'https://otlp.nr-data.net:4318'
     *   Datadog (OTLP): 'http://datadog-agent:4318'
     *   AWS X-Ray:      'http://aws-otel-collector:4318'
     */
    endpoint?: string;

    /**
     * Headers de autenticação do coletor.
     * Padrão: OTEL_EXPORTER_OTLP_HEADERS
     * Formato: 'key=value,key2=value2'
     * Exemplo: 'Authorization=Bearer <token>'
     */
    headers?: string;
  };

  /**
   * Sampling — controla quantas requests geram trace.
   * Padrão: OTEL_TRACES_SAMPLER || 'parentbased_always_on'
   *
   * Dev:  'parentbased_always_on' (100%)
   * Prod: 'parentbased_traceidratio' com samplerArg='0.1' (10%)
   */
  sampler?: string;

  /**
   * Argumento numérico do sampler (0.0–1.0).
   * Padrão: OTEL_TRACES_SAMPLER_ARG || '1.0'
   */
  samplerArg?: string;

  /**
   * Formato dos Trace IDs e Span IDs gerados.
   * Padrão: OTEL_ID_FORMAT || 'short-hash'
   *
   * Opções:
   * - 'short-hash'       — 12 chars Trace ID (como git short hashes) — RECOMENDADO
   * - 'full-hash'        — 32 chars hex (compatível com Jaeger)
   * - 'uuid-no-hyphens'  — 32 chars hex (UUID format sem hífens)
   * - 'uuid-with-hyphens'— 36 chars (UUID format original)
   *
   * Exemplo de Trace ID por formato:
   * - short-hash:        a1b2c3d4e5f6
   * - full-hash:         a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4
   * - uuid-no-hyphens:   cc02d2dd9c5b488588c4b4b18325770e
   * - uuid-with-hyphens: cc02d2dd-9c5b-4885-88c4-b4b18325770e
   */
  idFormat?: "short-hash" | "full-hash" | "uuid-no-hyphens" | "uuid-with-hyphens";
}
