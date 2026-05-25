import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { ConfigurableTraceStackService } from '../services/configurable-trace-stack.service';

/**
 * Inicializa e limpa a pilha de chamadas para cada requisição.
 * Deve ser registrado no início da cadeia de interceptadores.
 */
@Injectable()
export class TraceStackInterceptor implements NestInterceptor {
  constructor(private readonly traceStack: ConfigurableTraceStackService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    // Limpar stack anterior (defensivo)
    this.traceStack.clear();

    return next.handle().pipe(
      finalize(() => {
        // Limpar stack após requisição
        this.traceStack.clear();
      }),
    );
  }
}
