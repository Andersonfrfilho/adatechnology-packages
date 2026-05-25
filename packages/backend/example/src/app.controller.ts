import { Controller, Get, Inject } from '@nestjs/common';
import { AppService } from './app.service';
import { LOGGER_PROVIDER } from '@adatechnology/nestjs-logger';
import type { LoggerProviderInterface } from '@adatechnology/nestjs-logger';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    @Inject(LOGGER_PROVIDER) private readonly logger: LoggerProviderInterface,
  ) {}

  @Get()
  getHello(): string {
    this.logger?.info?.({
      message: 'getHello called',
      meta: { status: 'example app running' },
    });
    return this.appService.getHello();
  }
}
