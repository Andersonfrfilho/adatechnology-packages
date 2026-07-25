# Instruções para agentes de IA

Este repositório é um monorepo full-stack da Ada Technology. Antes de analisar,
planejar ou alterar código, leia integralmente:

1. `CLAUDE.md`, na raiz deste repositório.
2. `~/.claude/rules/rules/code-standart.md`.
3. `~/.claude/rules/rules/model-economy.md`.
4. `~/.claude/rules/ada-branding.md` quando a tarefa envolver documentos,
   propostas, apresentações ou materiais destinados a clientes.
5. `~/.claude/rules/PROMPT.MD` e `~/.claude/rules/README.md` apenas quando a
   tarefa envolver criação ou revisão de prompts.

Se um arquivo externo não estiver acessível no ambiente atual, informe isso e
use `CLAUDE.md` e este arquivo como fallback. Instruções do sistema, do
desenvolvedor e do usuário têm precedência sobre este documento.

## Ferramentas

- Use `rtk` explicitamente nos comandos compatíveis para reduzir a saída:
  `rtk read`, `rtk git`, `rtk test`, `rtk tsc`, `rtk lint`, `rtk pnpm`,
  `rtk npm`, `rtk diff` e equivalentes.
- Se o RTK falhar por incompatibilidade ou permissão, execute a ferramenta
  original e registre resumidamente a limitação.
- Para perguntas transversais sobre arquitetura, dependências ou fluxo entre
  módulos, verifique primeiro se existe `graphify-out/graph.json`. Quando
  existir, priorize `graphify query`, `graphify affected`, `graphify path` ou
  `graphify explain` antes de fazer buscas amplas.
- Não reconstrua o grafo sem necessidade. Use `graphify update .` somente
  quando o grafo estiver ausente ou desatualizado para a tarefa.
- Use SocratiCode quando suas ferramentas MCP estiverem disponíveis na sessão.
  Se não estiverem, use Graphify, `rg` e inspeção local sem alegar que o
  SocratiCode foi executado.
- Use os MCPs e skills efetivamente expostos pela sessão quando forem
  pertinentes. Uma configuração presente somente no Claude não torna a
  ferramenta automaticamente disponível no Codex.

## Execução e qualidade

- Preserve alterações preexistentes do usuário e não reverta arquivos fora do
  escopo.
- Antes de criar uma abstração, procure implementações, tipos e constantes
  equivalentes no repositório.
- Siga a arquitetura, nomenclatura, tipagem, tratamento de erros, testes e
  documentação definidos nas regras compartilhadas e no `CLAUDE.md`.
- Use TypeScript estrito; não introduza `any`.
- Ao alterar arquitetura, rotas, contratos ou regras de negócio, atualize a
  documentação contextual correspondente.
- Valide mudanças na menor unidade relevante e, quando aplicável, execute
  typecheck, lint, testes e build.
- Não crie commits sem solicitação explícita do usuário.

## Compatibilidade de modelos

As referências a `haiku`, `sonnet`, `opus` ou `fable` em
`model-economy.md` descrevem papéis e níveis de complexidade do ecossistema
Claude. No Codex, use a seguinte equivalência funcional:

| Papel no documento | Modelo Codex recomendado | Raciocínio |
| --- | --- | --- |
| `haiku` — tarefa mecânica, clara e repetível | `gpt-5.6-luna` | `low` |
| `sonnet` — execução padrão e trabalho cotidiano | `gpt-5.6-terra` | `medium` |
| `opus` / `fable` — arquitetura e decisões complexas | `gpt-5.6-sol` | `high` ou `xhigh` |

Se as variantes Sol, Terra ou Luna não estiverem disponíveis na sessão, use
`gpt-5.6` com `model_reasoning_effort` equivalente: `low` para tarefas
mecânicas, `medium` para execução padrão e `high` ou `xhigh` para arquitetura.

Antes de iniciar uma fase que declare um modelo:

1. Compare o papel recomendado com o modelo e o nível de raciocínio atuais.
2. Se a sessão permitir troca de modelo, recomende a equivalência Codex da
   tabela.
3. Se a troca não estiver disponível, continue com o modelo atual, ajuste o
   esforço de raciocínio quando possível e preserve todos os gates de
   qualidade.
4. Não solicite comandos `/model` do Claude em uma sessão Codex.

Os nomes dos modelos podem variar conforme plano, superfície e catálogo da
sessão. Nunca bloqueie uma tarefa apenas porque uma variante recomendada não
está disponível; use o modelo Codex mais próximo pelo papel e pela capacidade.
