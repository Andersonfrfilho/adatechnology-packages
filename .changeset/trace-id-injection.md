---
"@adatechnology/logger": patch
---

feat: inject OTel trace ID into logs for Jaeger correlation — enables linking logs (via requestId in Loki) with traces (via traceId in Jaeger)
