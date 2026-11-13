export const SHARED_ERRORS = {
  DEFAULT_STATUS: 502,
  INTERNAL_STATUS: 500,
};

export const SHARED_ERROR_MESSAGES = {
  UPSTREAM_ERROR: "Upstream error",
  NO_RESPONSE: "No response from upstream service",
  UNEXPECTED_ERROR: "Unexpected error",
  MAPPING_FAILURE: "Error mapping failure",
};

// Regex used to detect internal stack frames in shared package. Keep slightly
// more permissive to include package paths and internal markers.
export const SHARED_INTERNAL_FRAME_RE = /node_modules|internal|\(internal|axios|packages\/http|@adatechnology\/http-client/;
