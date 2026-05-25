export type GetParams = {
  key: string;
};

export type SetParams<T> = {
  key: string;
  value: T;
  ttlInSeconds?: number;
};

export type DelParams = {
  key: string;
};

export type SetEncryptedParams<T> = {
  key: string;
  value: T;
  ttlInSeconds?: number;
  secret?: string;
};

export type GetEncryptedParams = {
  key: string;
  secret?: string;
};

export interface CacheProviderInterface {
  get<T>(params: GetParams): Promise<T | null>;
  set<T>(params: SetParams<T>): Promise<void>;
  del(params: DelParams): Promise<void>;
  clear(): Promise<void>;

  /**
   * Serializa, cifra (AES-256-GCM) e armazena o valor no cache.
   * @param key   Chave do cache
   * @param value Valor a ser armazenado (qualquer tipo serializável)
   * @param ttlInSeconds TTL em segundos (opcional)
   * @param secret Chave de criptografia (32 bytes / 64 hex chars). Se omitido usa a configuração do módulo.
   */
  setEncrypted<T>(params: SetEncryptedParams<T>): Promise<void>;

  /**
   * Recupera, decifra e desserializa um valor armazenado com `setEncrypted`.
   * Retorna `null` se a chave não existir, estiver expirada ou se a decifração falhar.
   * @param key    Chave do cache
   * @param secret Chave de criptografia usada no `setEncrypted` correspondente.
   */
  getEncrypted<T>(params: GetEncryptedParams): Promise<T | null>;
}
