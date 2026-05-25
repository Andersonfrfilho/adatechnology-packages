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
    // Error.captureStackTrace is a V8/Node extension — guard and narrow its type
    // to avoid using `any` while still calling it when available.
    const capturable = Error as unknown as {
      captureStackTrace?: (err: Error, ctor?: Function) => void;
    };
    capturable.captureStackTrace?.(this, this.constructor as Function);
  }
}
