## 0.0.17

### Patch Changes

- feat: add `initTracing()` and `extractAmqpContext()` for centralized observability
  - New `TracingConfig` interface for provider-agnostic tracing config
  - `initTracing()` dynamically loads OTel SDK (optional peer dep, fails gracefully)
  - `extractAmqpContext()` extracts `x-request-id` + W3C `traceparent` from AMQP headers
  - `tracing?: TracingConfig` field added to `LoggerConfig`

# @adatechnology/logger

## 0.0.2

### Patch Changes

- fix to use packages logger and use
