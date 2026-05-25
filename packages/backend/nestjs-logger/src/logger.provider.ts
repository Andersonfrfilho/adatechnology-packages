import { Injectable, Inject } from "@nestjs/common";
import type {
  DebugParams,
  DebugResult,
  ErrorParams,
  ErrorResult,
  InfoParams,
  InfoResult,
  LoggerProviderInterface,
  WarnParams,
  WarnResult,
} from "./logger.interface";
import { WINSTON_LOGGER } from "./implementations/winston/winston.logger.token";

@Injectable()
export class LoggerProvider implements LoggerProviderInterface {
  constructor(
    @Inject(WINSTON_LOGGER)
    private readonly implementation: LoggerProviderInterface,
  ) {}

  debug(params: DebugParams): DebugResult {
    return this.implementation.debug(params);
  }

  info(params: InfoParams): InfoResult {
    return this.implementation.info(params);
  }

  warn(params: WarnParams): WarnResult {
    return this.implementation.warn(params);
  }

  error(params: ErrorParams): ErrorResult {
    return this.implementation.error(params);
  }
  setContext?(context: string): void {
    if (typeof this.implementation.setContext === "function") {
      return this.implementation.setContext(context);
    }
  }
}
