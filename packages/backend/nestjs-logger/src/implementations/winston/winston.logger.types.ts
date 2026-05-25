import { LoggerOptions } from "winston";

export interface ObfuscatorKey {
  key: string;
  obfuscator: Obfuscator;
}

export interface WinstonModuleConfig {
  loggerOptions?: LoggerOptions;
  obfuscator?: Obfuscator;
  obfuscatorKeys?: Array<string | ObfuscatorKey>;
}

export type Obfuscator = (value: unknown) => unknown;

export type SensitiveEntry = string | { key: string; obfuscator: Obfuscator };
