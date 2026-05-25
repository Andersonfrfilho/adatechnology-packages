import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { TracingFactoryService } from '../services/tracing-factory.service';

/**
 * Interceptor agnóstico a fornecedor que injeta requestId
 * Usa TracingFactoryService para determinar qual provedor usar
 */
@Injectable()
export class ConfigurableRequestIdInterceptor implements NestInterceptor {
  constructor(private tracingFactory: TracingFactoryService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const requestId = (req as any).requestId;

    if (requestId) {
      // Injetar no provedor de tracing configurado
      this.tracingFactory.injectRequestId(requestId);
    }

    return next.handle();
  }
}
