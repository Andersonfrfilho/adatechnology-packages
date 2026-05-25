---
"@adatechnology/nestjs-logger": patch
---

fix: remove stale compiled artifacts from src/ that broke tsup DTS consolidation

Artefatos compilados (.js, .d.ts, .js.map) estavam presentes dentro de src/ e faziam o tsup
ler o src/index.d.ts antigo durante a geração de tipos, ignorando os re-exports adicionados
recentemente (initTracing, TracingConfig, extractAmqpContext, AmqpMessageLike, AmqpExtractedContext).

Correções:
- Removidos todos os artefatos compilados de src/
- .gitignore atualizado para bloquear src/**/*.js e src/**/*.d.ts
- tsconfig.json: removido declarationDir desnecessário, composite false explícito
- Fix de tipagem no winston.logger.module.ts (TransformFunction retornava tipo errado)

dist/index.d.ts agora exporta corretamente todos os símbolos públicos da lib.
