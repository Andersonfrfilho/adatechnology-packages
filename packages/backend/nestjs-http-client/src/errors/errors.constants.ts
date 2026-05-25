export const HTTP_SERVICE_NAME: string = "@adatechnology/http-client";

export const HTTP_ERRORS = {
  DEFAULT_STATUS: 502,
  INTERNAL_STATUS: 500,
};

export const HTTP_ERROR_MESSAGES = {
  UPSTREAM_ERROR: "Upstream error",
  NO_RESPONSE: "No response from upstream service",
  UNEXPECTED_ERROR: "Unexpected error",
  MAPPING_FAILURE: "Error mapping failure",
};

// Regex used to detect internal stack frames that should be ignored when
// extracting the origin of an error. Exported so tests and other modules
// can reuse the same pattern.
export const INTERNAL_FRAME_RE = /node_modules|internal|axios/;
