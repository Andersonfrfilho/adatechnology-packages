# CLAUDE.md — @adatechnology/conversation-contracts

## Propósito

Fonte única de tipos, schemas zod e portas do núcleo de conversa. **Sem comportamento de runtime** — apenas tipos, interfaces de porto e validações. Produtos que consomem conversa validam com ele, integrações tipam com ele: mudança de contrato quebra os consumidores em compile-time, nunca em produção.

Spec: `specs/211-o-nucleo-de-conversa-ganha-o-email/spec.md` · ADR: `docs/adr/0085-conversation-core.md`

## Invariantes (quebrar = code review reprovado)

- **`companyId` nunca entra em schema de corpo de requisição.** Vem do contexto autenticado.
- **Nenhum import de `meta-whatsapp-*` nem de `notification-*`.** Conversa é agnóstica a canal. Canais são descritos por estruturas, nunca por importação.
- **Nenhuma PII em tipo persistido além do identificador que o canal exige.** Telefone, e-mail, mensagem — quando persistidos — são opacos ou mascarados.
- **O núcleo não conhece o domínio de produto:** as palavras `occurrence`, `contractor`, `driver`, `lead` são proibidas em `src/` (haverá teste que reprova).
- **Nunca lê `process.env`.** Config vem por injeção de dependência.
- **Sem `any`.** TypeScript `strict: true` a toda hora.
- **Única dependência de runtime: `zod`.**
- **Nome de canal, status, capacidade é contrato de host** — renomear é major version.

## Comandos

```bash
pnpm --filter @adatechnology/conversation-contracts run check   # tsc --noEmit
pnpm --filter @adatechnology/conversation-contracts run test    # bun test
pnpm --filter @adatechnology/conversation-contracts run build   # tsup (esm + cjs + dts)
```
