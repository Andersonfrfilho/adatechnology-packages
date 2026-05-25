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

  const idFormat =
    config?.idFormat ?? process.env.OTEL_ID_FORMAT ?? "short-hash";

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
      idGenerator: buildIdGenerator(idFormat),
      instrumentations: [
        getNodeAutoInstrumentations({
          "@opentelemetry/instrumentation-fs": { enabled: false },
          "@opentelemetry/instrumentation-dns": { enabled: false },
          // amqplib auto-instrumentado → propaga traceparent nos headers AMQP
          "@opentelemetry/instrumentation-amqplib": { enabled: true },
        }),
      ],
    });

    console.log(
      `[tracing] OpenTelemetry initialized — service=${serviceName} idFormat=${idFormat} endpoint=${otlpEndpoint} sampler=${sampler}`,
    );

    sdk.start();

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
 * Cria um IdGenerator customizável. Suporta múltiplos formatos:
 *
 * - "short-hash" (padrão): 12 chars hex (como git short hashes)
 *   Trace ID: a1b2c3d4e5f6, Span ID: 1a2b3c4d
 *
 * - "full-hash": 32 chars hex (compatível com Jaeger)
 *   Trace ID: a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4
 *
 * - "uuid-no-hyphens": 32 chars hex (UUID format sem hífens)
 *   Trace ID: cc02d2dd9c5b488588c4b4b18325770e
 *
 * - "uuid-with-hyphens": 36 chars (UUID format original — não recomendado para Jaeger)
 *   Trace ID: cc02d2dd-9c5b-4885-88c4-b4b18325770e
 *
 * Configurável via OTEL_ID_FORMAT environment variable.
 */
function buildIdGenerator(format: string): any {
  try {
    /* eslint-disable @typescript-eslint/no-require-imports */
    const { RandomIdGenerator } = require(
      "@opentelemetry/sdk-trace-base",
    ) as typeof import("@opentelemetry/sdk-trace-base");
    /* eslint-enable @typescript-eslint/no-require-imports */

    class CustomIdGenerator extends RandomIdGenerator {
      private format: string;

      constructor(format: string) {
        super();
        this.format = format;
      }

      generateSpanId(): string {
        switch (this.format) {
          case "short-hash":
            return this.generateRandomHex(8); // 8 chars
          case "full-hash":
          case "uuid-no-hyphens":
            return this.generateRandomHex(16); // 16 chars
          case "uuid-with-hyphens":
            return this.generateUUID().substring(0, 8); // first 8 from UUID
          default:
            return this.generateRandomHex(8);
        }
      }

      generateTraceId(): string {
        switch (this.format) {
          case "short-hash":
            return this.generateRandomHex(12); // 12 chars (like git short hash)
          case "full-hash":
          case "uuid-no-hyphens":
            return this.generateRandomHex(32); // 32 chars (Jaeger compatible)
          case "uuid-with-hyphens":
            return this.generateUUID(); // 36 chars (standard UUID)
          default:
            return this.generateRandomHex(12);
        }
      }

      private generateRandomHex(length: number): string {
        const chars = "0123456789abcdef";
        let result = "";
        for (let i = 0; i < length; i++) {
          result += chars[Math.floor(Math.random() * 16)];
        }
        return result;
      }

      private generateUUID(): string {
        // Gera UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
        const hex = () => Math.floor(Math.random() * 16).toString(16);
        return (
          this.generateRandomHex(8) +
          "-" +
          this.generateRandomHex(4) +
          "-4" +
          this.generateRandomHex(3) +
          "-" +
          this.generateRandomHex(4) +
          "-" +
          this.generateRandomHex(12)
        );
      }
    }

    return new CustomIdGenerator(format);
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
