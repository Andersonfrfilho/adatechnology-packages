export enum LoggerLevel {
  DEBUG = "debug",
  INFO = "info",
  WARN = "warn",
  ERROR = "error",
}

export type LogParams = {
  message: string;
  context?: string;
  lib?: string;
  libVersion?: string;
  libMethod?: string;
  meta?: Record<string, unknown>;
};

export type LogResult = void;

export type DebugParams = LogParams;
export type DebugResult = LogResult;

export type InfoParams = LogParams;
export type InfoResult = LogResult;

export type WarnParams = LogParams;
export type WarnResult = LogResult;

export type ErrorParams = LogParams;
export type ErrorResult = LogResult;

export interface LoggerProviderInterface {
  debug(params: DebugParams): DebugResult;
  info(params: InfoParams): InfoResult;
  warn(params: WarnParams): WarnResult;
  error(params: ErrorParams): ErrorResult;
  setContext?(context: string): void;
}

export type WriteLogParams = {
  level: LoggerLevel;
  payload: LogParams;
};

export type WriteLogResult = LogResult;
