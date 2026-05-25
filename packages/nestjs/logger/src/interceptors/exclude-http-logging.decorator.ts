import { SetMetadata } from "@nestjs/common";

export const EXCLUDE_HTTP_LOGGING_KEY = "EXCLUDE_HTTP_LOGGING";

export const ExcludeHttpLogging = () =>
  SetMetadata(EXCLUDE_HTTP_LOGGING_KEY, true);
