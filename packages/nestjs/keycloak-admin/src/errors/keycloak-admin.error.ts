export class KeycloakAdminError extends Error {
  public readonly statusCode?: number;
  public readonly code?: string;
  public readonly context?: Record<string, unknown>;

  constructor(params: {
    message: string;
    statusCode?: number;
    code?: string;
    context?: Record<string, unknown>;
  }) {
    super(params.message);
    this.name = "KeycloakAdminError";
    this.statusCode = params.statusCode;
    this.code = params.code;
    this.context = params.context;
    Object.setPrototypeOf(this, KeycloakAdminError.prototype);
  }
}
