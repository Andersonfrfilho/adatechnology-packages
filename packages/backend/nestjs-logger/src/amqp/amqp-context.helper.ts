import { context, propagation } from "@opentelemetry/api";

/**
 * Interface mínima compatível com amqplib.ConsumeMessage.
 * Não requer amqplib como dependência — usa duck typing.
 */
export interface AmqpMessageLike {
  properties?: {
    headers?: Record<string, unknown>;
    correlationId?: string;
  };
}

export interface AmqpExtractedContext {
  /** requestId propagado pelo produtor via header x-request-id */
  requestId: string | undefined;
  /** Contexto OTel extraído dos headers W3C traceparent/tracestate */
  parentCtx: ReturnType<typeof context.active>;
}

/**
 * Extrai requestId e contexto OTel dos headers de uma mensagem AMQP.
 *
 * Uso nos consumers (substitui o helper local de cada serviço):
 * ```ts
 * import { extractAmqpContext, runWithContext } from '@adatechnology/nestjs-logger';
 * import { context } from '@opentelemetry/api';
 * import type { ConsumeMessage } from 'amqplib';
 *
 * @RabbitSubscribe(...)
 * async onEvent(payload: T, amqpMsg: ConsumeMessage): Promise<void> {
 *   const { requestId: propagatedId, parentCtx } = extractAmqpContext(amqpMsg);
 *   const requestId = propagatedId ?? `msg:type:${Date.now().toString(36)}`;
 *   return context.with(parentCtx, () =>
 *     runWithContext({ requestId }, async () => { ... })
 *   );
 * }
 * ```
 *
 * O `parentCtx` conecta spans do Worker ao trace do Producer no Jaeger.
 * O `requestId` permite correlacionar logs de API e Worker no Loki.
 */
export function extractAmqpContext(
  amqpMsg: AmqpMessageLike | undefined | null,
): AmqpExtractedContext {
  const headers = (amqpMsg?.properties?.headers as Record<string, unknown>) ?? {};

  const requestId =
    typeof headers["x-request-id"] === "string"
      ? headers["x-request-id"]
      : undefined;

  // Extrai traceparent + tracestate → continua o trace do Producer no Jaeger
  const parentCtx = propagation.extract(
    context.active(),
    headers as Record<string, string>,
  );

  return { requestId, parentCtx };
}
