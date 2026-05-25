// Tipos leves que representam requests/responses de diferentes adapters (Express/Fastify)
export type RequestLike = {
  headers?: Record<string, unknown> | undefined;
  [key: string]: unknown;
};

export type ResponseLike = {
  [key: string]: unknown;
};

export type NextFunctionLike = (err?: unknown) => void;
