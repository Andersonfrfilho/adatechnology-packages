import { Injectable, Inject } from '@nestjs/common';
import { LOGGER_PROVIDER } from '@adatechnology/nestjs-logger';
import type { LoggerProviderInterface } from '@adatechnology/nestjs-logger';

@Injectable()
export class AppService {
  constructor(
    @Inject(LOGGER_PROVIDER) private readonly logger: LoggerProviderInterface,
  ) {}

  getHello(): string {
    this.logger?.debug?.({
      message: 'AppService.getHello',
      meta: { ts: Date.now() },
    });
    return 'Hello World!';
  }
}
