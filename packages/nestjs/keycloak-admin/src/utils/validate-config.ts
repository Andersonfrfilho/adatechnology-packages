import { KeycloakAdminError } from "../errors/keycloak-admin.error";
import type { KeycloakAdminConfig } from "../keycloak-admin.interface";

interface ValidationIssue {
  field: string;
  message: string;
}

export function validateKeycloakAdminConfig(
  config: KeycloakAdminConfig,
): void {
  const issues: ValidationIssue[] = [];

  if (!config) {
    throw new KeycloakAdminError({
      message: "KeycloakAdminConfig is required. Provide an object with baseUrl, realm, adminUser and adminPassword.",
      statusCode: 400,
      code: "KEYCLOAK_ADMIN_CONFIG_MISSING",
    });
  }

  if (typeof config.baseUrl !== "string" || config.baseUrl.trim() === "") {
    issues.push({
      field: "baseUrl",
      message: "baseUrl is required and must be a non-empty string (e.g. 'http://localhost:8081')",
    });
  } else if (
    !config.baseUrl.startsWith("http://") &&
    !config.baseUrl.startsWith("https://")
  ) {
    issues.push({
      field: "baseUrl",
      message: `baseUrl must start with 'http://' or 'https://'. Received: '${config.baseUrl}'`,
    });
  }

  if (typeof config.realm !== "string" || config.realm.trim() === "") {
    issues.push({
      field: "realm",
      message: "realm is required and must be a non-empty string (e.g. 'BACKEND')",
    });
  }

  if (typeof config.adminUser !== "string" || config.adminUser.trim() === "") {
    issues.push({
      field: "adminUser",
      message: "adminUser is required and must be a non-empty string",
    });
  }

  if (
    typeof config.adminPassword !== "string" ||
    config.adminPassword.trim() === ""
  ) {
    issues.push({
      field: "adminPassword",
      message: "adminPassword is required and must be a non-empty string",
    });
  }

  if (issues.length > 0) {
    const summary = issues.map((i) => `  - ${i.field}: ${i.message}`).join("\n");
    throw new KeycloakAdminError({
      message: `KeycloakAdminConfig validation failed:\n${summary}`,
      statusCode: 400,
      code: "KEYCLOAK_ADMIN_CONFIG_INVALID",
      context: { issues },
    });
  }
}
