export const ALGORITHM = "aes-256-gcm";
export const IV_LENGTH = 12; // 96-bit IV recommended for GCM
export const TAG_LENGTH = 16; // 128-bit auth tag
export const SALT = "adatechnology-cache-v1"; // fixed salt — key derivation makes secret length-agnostic
