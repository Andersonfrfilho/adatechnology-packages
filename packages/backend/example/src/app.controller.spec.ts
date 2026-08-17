import { Test, TestingModule } from '@nestjs/testing';
import { LOGGER_PROVIDER } from '@adatechnology/nestjs-logger';
import type { LoggerProviderInterface } from '@adatechnology/nestjs-logger';
import { AppController } from './app.controller';
import { AppService } from './app.service';

const mockLoggerProvider: LoggerProviderInterface = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        { provide: LOGGER_PROVIDER, useValue: mockLoggerProvider },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(appController.getHello()).toBe('Hello World!');
    });
  });
});
