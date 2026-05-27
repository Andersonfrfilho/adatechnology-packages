---
'@adatechnology/nestjs-logger': patch
---

Normalize requestId to remove hyphens from UUID format for cleaner logs

RequestId with UUID format now removes hyphens (32 hex chars) instead of keeping them (36 chars with hyphens) for faster searching in logs.
