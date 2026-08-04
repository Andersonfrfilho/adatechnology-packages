# ADR 0001 — Trio plugável de notificações: módulo, fronteira HTTP e adaptadores

- **Data:** 2026-08-01
- **Status:** aceito
- **Contexto da decisão:** `.specs/features/notification-trio/spec.md`
- **Regra de referência:** `~/.claude/rules/rules/packages/pluggable-module.md`

---

## 1. Módulo plugável, não serviço central

**Decisão:** a capacidade de notificação é publicada como pacotes versionados, consumidos
por cada produto, e não como um gateway HTTP central.

**Por quê:** pela tabela da §1 da regra — cada produto tem credencial própria (número
WhatsApp, remetente SMTP, projeto Firebase), todos os consumidores estão na stack Bun/TS,
e nenhum produto quer mais um deploy nem mais um banco. O gateway só se justificaria com
consumidor fora da stack ou necessidade de centralizar credenciais.

**Reversibilidade:** alta. Um gateway futuro nasce hospedando este mesmo módulo — a
decisão não fecha a porta, só evita pagar o custo antes da necessidade.

---

## 2. Provider (stateless) separado de module (stateful)

**Decisão:** os drivers de canal vivem em `push-provider` e `email-provider`, fora do
`notification-module`.

**Por quê:**

- Simetria já estabelecida no monorepo (`meta-whatsapp-provider`, `fiscal-provider`,
  `object-storage-provider`): provider é SDK sem estado; module tem Drizzle, migrations e
  rotas.
- Quem só quer inbox não instala `firebase-admin` (~40 MB) nem `nodemailer`.
- Há consumidor real de driver sem banco: `financiamento-imobiliario-bot` só manda e-mail.

**Alternativa descartada:** drivers dentro do módulo, atrás de flags. Descartada porque a
dependência entra no grafo de instalação de todo consumidor, mesmo desligada.

---

## 3. A tabela de rotas declarativa é a fonte única da fronteira HTTP

**Decisão:** o módulo declara as rotas como dados — `NotificationRoute[]` com método,
path, escopo, schemas zod e um handler puro sobre `NotificationRequestContext`, **sem
nenhum tipo de framework**. Dela derivam os adaptadores, os paths OpenAPI e os testes de
contrato.

**Por quê:** é a decisão cara desta spec, e nasce de um custo medido. O
`meta-whatsapp-module` entrega use-cases e nada de HTTP; para expô-los, o quickcart
escreveu 1.353 linhas de cola (`modules/conversation/infra/http/`: 622 + 204 + 111 + 99 +
86 + 80 + 65). Nada disso é regra de negócio — é tradução entre use-case e `Bun.serve`. O
próximo produto reescreveria as mesmas linhas, divergindo.

Com a tabela declarativa:

- **Adaptadores finos.** `./http/fetch` e `./http/uws` só traduzem transporte; a lógica de
  rota existe uma vez.
- **Sem divergência entre adaptadores.** Um teste de contrato compartilhado roda a mesma
  bateria nos dois e exige status, envelope e headers idênticos.
- **OpenAPI sem duplicação.** `notificationOpenApiPaths()` deriva da mesma tabela; rota
  nova sem documentação quebra o build.

**Métrica de aceite:** montar as rotas no quickcart deve custar **≤ 25 linhas**, contra as
1.353 do modelo atual. Se passar disso, o pacote falhou no requisito.

**Alternativa descartada:** exportar só use-cases, como hoje. É exatamente o custo que
esta decisão existe para eliminar.

---

## 4. Dois adaptadores: `fetch` e `uws`. Nenhum NestJS

**Decisão:** os adaptadores publicados são `./http/fetch` (WHATWG Request/Response —
`Bun.serve`, o `Router` do quickcart, Hono) e `./http/uws` (uWebSockets.js, o template
`micro-backend-uws`).

**Por quê:** NestJS foi abandonado no ecossistema. Os hosts reais são `Bun.serve`
(`quickcart/apps/api-quickcart`) e uWebSockets.js (`micro-backend-uws`).

**Conflito de plataforma registrado:** `code-standart.md` §2 determina `Bun.serve` e
**proíbe** instalar ou importar o addon `uWebSockets.js` para Node/V8 em app Bun — e o
template `micro-backend-uws` usa o addon. O SDK atende aos dois porque o parque tem os
dois; **convergir é decisão de plataforma, pendente, e não deste pacote**. O adaptador
`uws` é peer-dependente: quem não importa o entrypoint não instala nada.

---

## 5. O módulo não valida token nem lê a tabela de usuários

**Decisão:** duas portas obrigatórias — `AuthContextResolverPort` devolve identidade **já
validada pelo host** (`{ companyId, userId, scopes }`), e `RecipientResolverPort` resolve
e-mail/telefone/locale/timezone no instante do envio.

**Por quê:** emissão e validação de sessão são do host (`security.md` §2), e a tabela de
clientes é regra de negócio do produto. A consequência de privacidade é o ganho maior: o
módulo **nunca persiste endereço em claro** — `deliveries` guarda só `targetMasked`,
supressão guarda HMAC, e o job na fila carrega apenas `notificationId` (`worker.md`,
`security.md` §1).

A autorização por objeto continua sendo do módulo: toda leitura de inbox filtra por
`companyId` + `recipientUserId` do contexto, nunca por id vindo do cliente (BOLA/API1).

---

## 6. Consequências

- Seis pacotes para versionar e um gate de revisão com `opus` antes de cada publicação.
- Rota nova custa: uma entrada na tabela + um handler. Os dois adaptadores e o OpenAPI
  acompanham sozinhos.
- Adicionar um terceiro adaptador (Hono nativo, Express legado) é um arquivo novo, sem
  tocar em lógica de rota.
- Ligar um canal sem driver, ou rotas sem `authContextResolver`, **falha no boot** — não
  em produção, na primeira notificação.
