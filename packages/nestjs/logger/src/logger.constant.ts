export const DEFAULT_SENSITIVE_KEYS = [
  "password",
  "pass",
  "pwd",
  "token",
  "accessToken",
  "refreshToken",
  "authorization",
  "auth",
  "secret",
  "ssn",
  "creditCard",
];

// constantes de contexto
export const EMPTY_STRING = "";

// máscara padrão usada para valores sensíveis
// objeto com constantes relacionadas à máscara de valores sensíveis
export const MASK = {
  REPLACEMENT: "****",
  MIN_LENGTH: 4,
  EDGE_CHARS: 2,
} as const;

// exportações legadas para compatibilidade
export const MASK_REPLACEMENT = MASK.REPLACEMENT;
export const MASK_MIN_LENGTH = MASK.MIN_LENGTH;
export const MASK_EDGE_CHARS = MASK.EDGE_CHARS;

// separador usado no id fallback (Date.now() + separador + Math.random())
export const ID_FALLBACK_SEPARATOR = "-";
