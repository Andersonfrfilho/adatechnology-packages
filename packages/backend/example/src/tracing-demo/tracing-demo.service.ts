import { Injectable, Inject } from '@nestjs/common';
import { LOGGER_PROVIDER, LoggerProviderInterface } from '@adatechnology/nestjs-logger';
import { CACHE_PROVIDER, CacheProviderInterface } from '@adatechnology/nestjs-cache';
import { TraceMethod } from '../shared/decorators/trace-method.decorator';

@Injectable()
export class TracingDemoService {
  constructor(
    @Inject(LOGGER_PROVIDER) private logger: LoggerProviderInterface,
    @Inject(CACHE_PROVIDER) private cache: CacheProviderInterface,
  ) {}

  @TraceMethod()
  async processOrder(orderId: string) {
    this.logger.info({
      message: 'Processing order',
      context: `${this.constructor.name}.processOrder`,
      meta: { orderId },
    });

    // 1. Try cache first — shows lib call inside trace stack
    const cached = await this.getOrderFromCache(orderId);
    if (cached) {
      this.logger.info({
        message: 'Order returned from cache',
        context: `${this.constructor.name}.processOrder`,
        meta: { orderId },
      });
      return cached;
    }

    // 2. Build order
    const customer = await this.getCustomerForOrder(orderId);
    const result = { orderId, customer };

    // 3. Store in cache
    await this.storeOrderInCache(orderId, result);

    this.logger.info({
      message: 'Order processed successfully',
      context: `${this.constructor.name}.processOrder`,
      meta: { orderId, customerId: customer.customerId },
    });

    return result;
  }

  @TraceMethod()
  private async getOrderFromCache(orderId: string) {
    this.logger.debug({
      message: 'Checking cache for order',
      context: `${this.constructor.name}.getOrderFromCache`,
      meta: { key: `order:${orderId}` },
    });

    // Cache lib call → shows [@adatechnology/nestjs-cache:X.X.X][InMemoryCacheProvider.get] in log
    return this.cache.get<{ orderId: string; customer: any }>({ key: `order:${orderId}` });
  }

  @TraceMethod()
  private async storeOrderInCache(orderId: string, value: any) {
    this.logger.debug({
      message: 'Storing order in cache',
      context: `${this.constructor.name}.storeOrderInCache`,
      meta: { key: `order:${orderId}` },
    });

    // Cache lib call → shows [@adatechnology/nestjs-cache:X.X.X][InMemoryCacheProvider.set] in log
    await this.cache.set({ key: `order:${orderId}`, value, ttlInSeconds: 60 });
  }

  @TraceMethod()
  private async getCustomerForOrder(orderId: string) {
    this.logger.debug({
      message: 'Fetching customer for order',
      context: `${this.constructor.name}.getCustomerForOrder`,
      meta: { orderId },
    });

    const customerId = await this.getCustomerId(orderId);
    return { customerId, name: 'John Doe' };
  }

  @TraceMethod()
  private async getCustomerId(orderId: string): Promise<string> {
    this.logger.debug({
      message: 'Extracting customer ID',
      context: `${this.constructor.name}.getCustomerId`,
      meta: { orderId },
    });

    return `customer-${orderId}`;
  }
}
