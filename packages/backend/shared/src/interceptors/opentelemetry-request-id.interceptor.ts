import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { trace, context, createContextKey } from '@opentelemetry/api';
import { Observable } from 'rxjs';

const REQUEST_ID_KEY = createContextKey('request.id');
const CORRELATION_ID_KEY = createContextKey('correlation.id');

/**
 * Injeta requestId no contexto OpenTelemetry para que:
 * 1. O span do Jaeger tenha o requestId como atributo
 * 2. Bibliotecas externas (keycloak-admin, http-client) propaguem o requestId
 * 3. Logs estruturados correlacionem com o span via requestId
 */
@Injectable()
export class OpenTelemetryRequestIdInterceptor implements NestInterceptor {
  intercept(executionContext: ExecutionContext, next: CallHandler): Observable<any> {
    const req = executionContext.switchToHttp().getRequest();
    const requestId = (req as any).requestId;

    if (!requestId) {
      return next.handle();
    }

    const span = trace.getActiveSpan();
    if (span) {
      // Injetar requestId como atributo do span
      span.setAttribute('request.id', requestId);
      span.setAttribute('correlation.id', requestId);
    }

    // Propagar requestId através do contexto OpenTelemetry usando context.with()
    const ctx = context.active()
      .setValue(REQUEST_ID_KEY, requestId)
      .setValue(CORRELATION_ID_KEY, requestId);

    return new Observable(subscriber => {
      context.with(ctx, () => {
        next.handle().subscribe(subscriber);
      });
    });
  }
}
