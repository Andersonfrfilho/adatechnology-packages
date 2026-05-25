/**
 * Configuration for Keycloak Admin API client
 */
export interface KeycloakAdminConfig {
  baseUrl: string;
  realm: string;
  adminUser: string;
  adminPassword: string;
}

/**
 * Result of obtaining an admin token
 */
export interface GetAdminTokenResult {
  accessToken: string;
  expiresIn: number;
  tokenType: string;
}

/**
 * Params for updating a user via Keycloak Admin API
 */
export interface UpdateUserParams {
  userId: string;
  userData: Record<string, unknown>;
  adminToken: string;
}

/**
 * Params for resetting a user's password
 */
export interface ResetPasswordParams {
  userId: string;
  password: string;
  temporary: boolean;
  adminToken: string;
}

/**
 * Params for toggling a user's enabled state
 */
export interface ToggleUserEnabledParams {
  userId: string;
  enabled: boolean;
  adminToken: string;
}

/**
 * Params for deleting a user
 */
export interface DeleteUserParams {
  userId: string;
  adminToken: string;
}

/**
 * Params for updating user attributes (avatar, document, custom fields)
 */
export interface UpdateUserAttributesParams {
  userId: string;
  attributes: Record<string, string | string[]>;
  adminToken: string;
}

/**
 * Params for sending a verify email action
 */
export interface SendVerifyEmailParams {
  userId: string;
  adminToken: string;
}

/**
 * Params for creating a user via Keycloak Admin API (POST /admin/realms/{realm}/users)
 */
export interface CreateUserParams {
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  enabled: boolean;
  emailVerified: boolean;
  credentials?: Array<{ type: string; value: string; temporary: boolean }>;
  attributes?: Record<string, string | string[]>;
  adminToken: string;
}

/**
 * Keycloak Admin Client Interface
 *
 * Provides CRUD operations on Keycloak users via the Admin REST API.
 */
export interface KeycloakAdminClientInterface {
  /**
   * Obtain an admin access token using the master realm.
   */
  getAdminToken(): Promise<GetAdminTokenResult>;

  /**
   * Create a new user in Keycloak. Returns the user ID from the Location header.
   */
  createUser(params: CreateUserParams): Promise<string>;

  /**
   * Update a user in Keycloak.
   */
  updateUser(params: UpdateUserParams): Promise<void>;

  /**
   * Reset a user's password.
   */
  resetPassword(params: ResetPasswordParams): Promise<void>;

  /**
   * Enable or disable a user.
   */
  toggleUserEnabled(params: ToggleUserEnabledParams): Promise<void>;

  /**
   * Delete a user.
   */
  deleteUser(params: DeleteUserParams): Promise<void>;

  /**
   * Update user attributes (avatar, document, custom fields).
   */
  updateUserAttributes(params: UpdateUserAttributesParams): Promise<void>;

  /**
   * Send verify email action to a user.
   */
  sendVerifyEmail(params: SendVerifyEmailParams): Promise<void>;
}
