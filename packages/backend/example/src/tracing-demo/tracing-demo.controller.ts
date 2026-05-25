import { Controller, Get, Param, Inject } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { TracingDemoService } from './tracing-demo.service';
import { TraceMethod } from '../shared/decorators/trace-method.decorator';

/**
 * Controller para testar o novo sistema de tracing completo
 *
 * Endpoints:
 * - GET /tracing/order/:orderId - Testa rastreamento de call stack com TraceMethod
 */
@Controller('tracing')
export class TracingDemoController {
  constructor(
    private tracingDemo: TracingDemoService,
    @Inject(REQUEST) private request: Request,
  ) {}

  @Get('order/:orderId')
  @TraceMethod()
  async processOrder(@Param('orderId') orderId: string) {
    const requestId = (this.request as any).requestId;

    const result = await this.tracingDemo.processOrder(orderId);

    return {
      message: 'Order processed with complete call stack tracing',
      requestId,
      result,
      info: {
        orderId,
        stackTracked: true,
        decoratorsUsed: 'TracingDemoController.processOrder → TracingDemoService.processOrder → getCustomerForOrder → getCustomerId',
      },
    };
  }
}
