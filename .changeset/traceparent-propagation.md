---
'@adatechnology/nestjs-logger': patch
'@adatechnology/nestjs-http-client': patch
---

Implement W3C traceparent header propagation for distributed tracing

- RequestContextMiddleware: extract incoming traceparent header from Kong, generate W3C-compliant traceparent if missing, store in AsyncLocalStorage context with normalized 32-char traceId
- AxiosHttpProvider: inject traceparent header from context into all outgoing HTTP requests
- Enables proper distributed trace correlation across service boundaries (Kong → BFF → API → downstream services) in Grafana Tempo/Jaeger
