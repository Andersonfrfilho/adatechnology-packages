import { BaseAppErrorParams, ErrorContext } from "./errors.interfaces";

export class BaseAppError<Context = ErrorContext> extends Error {
  public readonly code?: string;
  public readonly status?: number;
  public readonly context?: Context;

  constructor(params: BaseAppErrorParams<Context>) {
    super(params.message);
    this.name = new.target.name;
    this.status = params.status;
    this.code = params.code;
    this.context = params.context;
    (Error as any).captureStackTrace?.(this, new.target);
  }
}
