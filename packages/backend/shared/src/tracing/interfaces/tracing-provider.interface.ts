/**
 * Interface abstrata para provedores de tracing.
 * Permite trocar entre Jaeger, Datadog, CloudTrace, etc sem alterar o código.
 */
export interface TracingProvider {
  /**
   * Inicializa o provedor de tracing
   */
  initialize(): Promise<void>;

  /**
   * Injeta requestId no contexto de tracing atual
   */
  injectRequestId(requestId: string): void;

  /**
   * Injeta a pilha de chamadas no contexto de tracing
   */
  injectCallStack(stack: string[]): void;

  /**
   * Fecha/cleanup do provedor
   */
  shutdown(): Promise<void>;

  /**
   * Nome do provedor (para logging/debug)
   */
  getName(): string;
}
