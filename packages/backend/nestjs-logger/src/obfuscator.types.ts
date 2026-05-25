import { SensitiveEntry } from "./implementations/winston/winston.logger.types";

export type DefaultObfuscatorParams = {
  obj: unknown;
  entries?: SensitiveEntry[];
};
