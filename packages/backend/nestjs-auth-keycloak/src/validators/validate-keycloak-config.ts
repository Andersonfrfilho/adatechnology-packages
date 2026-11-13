import { KeycloakError } from "../errors/keycloak-error";
import type { KeycloakConfig } from "../keycloak.interface";

interface ValidationIssue {
  field: string;
  message: string;
}

export function validateKeycloakConfig(config: KeycloakConfig): void {
  const issues: ValidationIssue[] = [];

  if (!config || typeof config !== "object") {
    throw new KeycloakError(
      "KeycloakConfig is required. Provide an object with baseUrl, realm and credentials.",
      { statusCode: 400 },
    );
  }

  if (typeof config.baseUrl !== "string" || config.baseUrl.trim() === "") {
    issues.push({
      field: "baseUrl",
      message:
        "baseUrl is required and must be a non-empty string (e.g. 'http://localhost:8081')",
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
      message:
        "realm is required and must be a non-empty string (e.g. 'BACKEND')",
    });
  }

  if (!config.credentials || typeof config.credentials !== "object") {
    issues.push({
      field: "credentials",
      message:
        "credentials is required and must be an object with clientId, clientSecret and grantType",
    });
  } else {
    const creds = config.credentials;

    if (
      typeof creds.clientId !== "string" ||
      creds.clientId.trim() === ""
    ) {
      issues.push({
        field: "credentials.clientId",
        message:
          "credentials.clientId is required and must be a non-empty string",
      });
    }

    if (
      typeof creds.clientSecret !== "string" ||
      creds.clientSecret.trim() === ""
    ) {
      issues.push({
        field: "credentials.clientSecret",
        message:
          "credentials.clientSecret is required and must be a non-empty string",
      });
    }

    if (
      creds.grantType !== "client_credentials" &&
      creds.grantType !== "password"
    ) {
      issues.push({
        field: "credentials.grantType",
        message: `credentials.grantType must be 'client_credentials' or 'password'. Received: '${creds.grantType}'`,
      });
    }

    if (creds.grantType === "password") {
      if (
        typeof creds.username !== "string" ||
        creds.username.trim() === ""
      ) {
        issues.push({
          field: "credentials.username",
          message:
            "credentials.username is required when grantType is 'password'",
        });
      }
      if (
        typeof creds.password !== "string" ||
        creds.password.trim() === ""
      ) {
        issues.push({
          field: "credentials.password",
          message:
            "credentials.password is required when grantType is 'password'",
        });
      }
    }
  }

  if (config.tokenCacheTtl !== undefined) {
    if (
      typeof config.tokenCacheTtl !== "number" ||
      config.tokenCacheTtl <= 0
    ) {
      issues.push({
        field: "tokenCacheTtl",
        message: `tokenCacheTtl must be a positive number in milliseconds. Received: ${config.tokenCacheTtl}`,
      });
    }
  }

  if (issues.length > 0) {
    const summary = issues
      .map((i) => `  - ${i.field}: ${i.message}`)
      .join("\n");
    throw new KeycloakError(
      `KeycloakConfig validation failed:\n${summary}`,
      { statusCode: 400, details: { issues } },
    );
  }
}
