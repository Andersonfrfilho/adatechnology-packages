export type EncryptParams = {
  plaintext: string;
  secret: string;
};

export type DecryptParams = {
  encoded: string;
  secret: string;
};
