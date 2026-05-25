import type { TracingConfig } from "./tracing.config";

/**
 * Inicializa o SDK de tracing distribuído.
 *
 * Lê configuração de env vars convencionais (OTEL_*, TRACING_PROVIDER) e aceita
 * overrides via `config`. As dependências pesadas do OTel SDK são carregadas
 * dinamicamente — se não estiverem instaladas, tracing é desabilitado silenciosamente.
 *
 * Uso em cada serviço (substitui instrumentation.ts individual):
 * ```ts
 * // src/instrumentation.ts
 * import { initTracing } from '@adatechnology/nestjs-logger';
 * initTracing();
 * ```
 *
 * Com overrides (raro — geralmente env vars bastam):
 * ```ts
 * initTracing({
 *   provider: 'opentelemetry',
 *   otlp: { endpoint: 'http://my-collector:4318' },
 *   sampler: 'parentbased_traceidratio',
 *   samplerArg: '0.1',
 * });
 * ```
 *
 * Troca de provider em produção: só muda TRACING_PROVIDER no ConfigMap k8s.
 * Nenhuma mudança de código necessária.
 */
export function initTracing(config?: TracingConfig): void {
  const provider =
    config?.provider ??
    (process.env.TRACING_PROVIDER as TracingConfig["provider"]) ??
    "opentelemetry";

  if (provider === "none") {
    console.log("[tracing] Tracing disabled (TRACING_PROVIDER=none)");
    return;
  }

  const serviceName =
    config?.serviceName ??
    process.env.OTEL_SERVICE_NAME ??
    process.env.npm_package_name ??
    "unknown-service";

  const serviceVersion =
    config?.serviceVersion ?? process.env.npm_package_version ?? "0.0.0";

  const otlpEndpoint =
    config?.otlp?.endpoint ??
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT ??
    "http://jaeger:4318";

  const otlpHeadersRaw =
    config?.otlp?.headers ?? process.env.OTEL_EXPORTER_OTLP_HEADERS ?? "";

  const sampler =
    config?.sampler ??
    process.env.OTEL_TRACES_SAMPLER ??
    "parentbased_always_on";

  const samplerArg =
    config?.samplerArg ?? process.env.OTEL_TRACES_SAMPLER_ARG ?? "1.0";

  // Carrega headers OTLP: formato 'key=value,key2=value2'
  const otlpHeaders: Record<string, string> = {};
  if (otlpHeadersRaw) {
    for (const pair of otlpHeadersRaw.split(",")) {
      const eq = pair.indexOf("=");
      if (eq > 0) {
        otlpHeaders[pair.slice(0, eq).trim()] = pair.slice(eq + 1).trim();
      }
    }
  }

  try {
    // Carregamento dinâmico — pacotes pesados ficam como peerDeps opcionais.
    // Se não estiverem instalados, tracing falha graciosamente sem derrubar o app.
    /* eslint-disable @typescript-eslint/no-require-imports */
    const { NodeSDK } = require(
      "@opentelemetry/sdk-node",
    ) as typeof import("@opentelemetry/sdk-node");
    const { OTLPTraceExporter } = require(
      "@opentelemetry/exporter-trace-otlp-http",
    ) as typeof import("@opentelemetry/exporter-trace-otlp-http");
    const { resourceFromAttributes } = require(
      "@opentelemetry/resources",
    ) as typeof import("@opentelemetry/resources");
    const { getNodeAutoInstrumentations } = require(
      "@opentelemetry/auto-instrumentations-node",
    ) as typeof import("@opentelemetry/auto-instrumentations-node");
    const { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } = require(
      "@opentelemetry/semantic-conventions",
    ) as typeof import("@opentelemetry/semantic-conventions");
    /* eslint-enable @typescript-eslint/no-require-imports */

    const sdk = new NodeSDK({
      resource: resourceFromAttributes({
        [ATTR_SERVICE_NAME]: serviceName,
        [ATTR_SERVICE_VERSION]: serviceVersion,
      }),
      traceExporter: new OTLPTraceExporter({
        url: `${otlpEndpoint}/v1/traces`,
        headers: otlpHeaders,
        timeoutMillis: 5000,
      }),
      sampler: buildSampler(sampler, samplerArg),
      idGenerator: buildIdGenerator(),
      instrumentations: [
        getNodeAutoInstrumentations({
          "@opentelemetry/instrumentation-fs": { enabled: false },
          "@opentelemetry/instrumentation-dns": { enabled: false },
          // amqplib auto-instrumentado → propaga traceparent nos headers AMQP
          "@opentelemetry/instrumentation-amqplib": { enabled: true },
        }),
      ],
    });

    sdk.start();
    console.log(
      `[tracing] OpenTelemetry initialized — service=${serviceName} endpoint=${otlpEndpoint} sampler=${sampler}`,
    );

    process.on("SIGTERM", () => {
      sdk
        .shutdown()
        .catch((err: unknown) =>
          console.error("[tracing] SDK shutdown error:", err),
        )
        .finally(() => process.exit(0));
    });
  } catch (err) {
    console.warn(
      "[tracing] Failed to initialize — tracing disabled.",
      err instanceof Error ? err.message : err,
    );
  }
}

/**
 * Cria um IdGenerator que gera Trace IDs em formato hex puro (32 caracteres)
 * compatível com Jaeger. O SDK padrão gera UUIDs com hífens (36 caracteres)
 * que Jaeger rejeita com: "TraceID cannot be longer than 32 hex characters".
 *
 * Formato gerado: cc02d2dd9c5b488588c4b4b18325770e (sem hífens, 32 chars)
 */
function buildIdGenerator(): any {
  try {
    /* eslint-disable @typescript-eslint/no-require-imports */
    const { RandomIdGenerator } = require(
      "@opentelemetry/sdk-trace-base",
    ) as typeof import("@opentelemetry/sdk-trace-base");
    /* eslint-enable @typescript-eslint/no-require-imports */

    class JaegerCompatibleIdGenerator extends RandomIdGenerator {
      generateSpanId(): string {
        // Gera 8 bytes (16 chars hex) para Span ID
        return this.generateRandomHex(16);
      }

      generateTraceId(): string {
        // Gera 16 bytes (32 chars hex) para Trace ID — compatível com Jaeger
        return this.generateRandomHex(32);
      }

      private generateRandomHex(length: number): string {
        const chars = "0123456789abcdef";
        let result = "";
        for (let i = 0; i < length; i++) {
          result += chars[Math.floor(Math.random() * 16)];
        }
        return result;
      }
    }

    return new JaegerCompatibleIdGenerator();
  } catch {
    return undefined; // Fallback para RandomIdGenerator padrão se falhar
  }
}

/**
 * Constrói o Sampler OTel a partir de strings de configuração.
 * Retorna undefined para usar o default do NodeSDK (parentbased_always_on).
 */
function buildSampler(
  sampler: string,
  samplerArg: string,
): import("@opentelemetry/sdk-node").NodeSDKConfiguration["sampler"] {
  try {
    const { ParentBasedSampler, TraceIdRatioBasedSampler, AlwaysOnSampler } =
      /* eslint-disable @typescript-eslint/no-require-imports */
      require(
        "@opentelemetry/sdk-trace-base",
      ) as typeof import("@opentelemetry/sdk-trace-base");
    /* eslint-enable @typescript-eslint/no-require-imports */

    switch (sampler) {
      case "parentbased_traceidratio": {
        const ratio = parseFloat(samplerArg);
        return new ParentBasedSampler({
          root: new TraceIdRatioBasedSampler(isNaN(ratio) ? 1.0 : ratio),
        });
      }
      case "always_off":
        return { shouldSample: () => ({ decision: 0 }) } as any;
      case "always_on":
        return new AlwaysOnSampler();
      default:
        return undefined; // parentbased_always_on é o default do SDK
    }
  } catch {
    return undefined;
  }
}
