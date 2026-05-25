export interface KeycloakRawTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

export interface ExtractedHttpError {
  statusCode?: number;
  details?: unknown;
  errorCode?: string;
}
