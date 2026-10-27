# Painel de templates de notificação — spec

> 🤖 Modelo: `opus` para o desenho (este documento), `sonnet` para execução das fases 1–4,
> `haiku` para o passe de locale/ícones da fase 5.

Status: proposta. Escopo: `@adatechnology/notification-contracts`, `notification-module`,
`notification-client`, `notification-ui`.

## 0. O que já existe (levantado no código, não presumido)

O pedido — "painel de criação, edição e remoção de templates por canal, com preview e múltiplo
envio por tipo de notificação" — está **majoritariamente implementado**. O que falta é menor e
mais específico do que o pedido sugere.

| Peça | Onde | Situação |
|---|---|---|
| Tabela `notification.templates` (`companyId, key, channel, locale, version`, `active`) | `notification-module/src/schema/schema.ts:29` | ✅ |
| `UpsertTemplateUseCase`, `ListTemplatesUseCase`, `SeedDefaultTemplatesUseCase` | `use-cases/Template.use-cases.ts` | ✅ |
| Rotas `GET/POST /notification-templates` | `http/managementRoutes.ts:147,159` | ✅ |
| Cliente HTTP `listTemplates` / `upsertTemplate` | `notification-client/src/httpClient.ts:78,86` | ✅ |
| Editor com preview pelo mesmo `renderTemplate` do envio | `notification-ui/src/hooks/useTemplateEditor.ts` | ✅ |
| Tela composta de configuração | `notification-ui/src/components/NotificationSettingsWorkspace.tsx` | ✅ |
| Canais `inbox, push, email, whatsapp, sms` | `notification-contracts/src/notification.types.ts:5` | ✅ contrato |
| Múltiplo envio por categoria (fan-out por preferência + quiet hours) | `shared/planDeliveries.ts` | ✅ |
| **Criar template novo** (chave/canal/locale inéditos) | — | ❌ falta |
| **Remover / desativar template** | — | ❌ falta |
| **Política de canais por tipo de notificação** (padrão da empresa) | — | ❌ falta |
| Provider de SMS | — | ❌ canal existe no contrato, provider não |

O editor atual só edita o que foi selecionado da lista: `save()` monta o `UpsertTemplateBody` a
partir do `draft` derivado de um template existente. Não há caminho para uma `key` que ainda não
está no banco, e `active: false` nunca é escrito por ninguém — nem no use-case, nem na rota, nem
na UI. Grep por `deleteTemplate|deactivateTemplate|archiveTemplate` nos três pacotes: zero.

## 1. Decisões de arquitetura

### 1.1 Remoção é desativação, nunca `DELETE`

A tabela é versionada por `(companyId, key, channel, locale, version)` e as entregas já enviadas
referenciam o template pela `templateKey` (`schema.ts:62`). Apagar linha quebra auditoria de
"qual texto o cliente recebeu". A remoção do painel grava `active: false` na versão ativa; a
listagem do editor já filtra `active` e já resolve a maior versão (decisão 1 do
`useTemplateEditor`), então a desativação some da tela sem mudança na leitura.

Consequência para o envio: `key` sem nenhuma versão ativa **não pode** virar erro silencioso.
O `SendNotification` precisa pular o canal com razão explícita (`template_inactive`), no mesmo
lugar onde já pula WhatsApp sem `whatsappTemplateName`.

### 1.2 Criação é o mesmo `upsert`, com identidade editável

Não entra use-case novo no backend. O que falta é **estado de UI**: um `draft` com identidade
(`key`, `channel`, `locale`) livre em vez de derivada do selecionado. O `upsert` já cria a
linha quando a identidade não existe.

Regra: identidade é imutável depois de criada. Editar `key` de um template existente não é
edição — é criar outro e deixar o antigo órfão. A UI trava os três campos quando há `selected`.

### 1.3 Política de canais por tipo é configuração da empresa, não do usuário

Hoje `planDeliveries` decide por: canais explícitos do chamador → senão preferência do usuário →
ausência de preferência = habilitado. Não existe camada "esta categoria sai por e-mail e push,
nunca por SMS" definida pela empresa.

Proposta: tabela `notification.category_policies` (`companyId, category, channel, enabled`),
consultada **antes** da preferência do usuário — a empresa define o conjunto possível, o usuário
opta por sair dentro dele. Preferência de usuário nunca liga canal que a política desligou.
Ausência de política = comportamento atual (todos os canais disponíveis), para não quebrar quem
já usa.

### 1.4 O preview continua vindo do `renderTemplate` do contracts

Está certo e não muda: `notification-contracts` é o único lugar da interpolação, justamente para
o preview não mentir. A tela de criação usa o mesmo caminho.

Falta uma coisa: `previewPayload` hoje é um objeto único por editor. Com criação de chave nova,
o operador não tem de onde tirar as variáveis. A resposta é o catálogo de variáveis (§1.7): o
`example` de cada variável declarada vira o payload de preview, sem mapa paralelo para manter.

### 1.5 Segurança do corpo editável

O corpo passa a ser escrito por operador de painel e renderizado em e-mail. Duas travas:

- ✅ **Verificado — já está correto.** `renderTemplate` (`notification-contracts/src/templateRender.ts`)
  aplica `escapeTemplateHtml` **depois** da interpolação e só no canal `email`, então tanto o
  payload quanto o próprio corpo escrito no painel são neutralizados: o operador não consegue
  injetar HTML nem por variável nem por texto. Já há teste com `<script>alert(1)</script>`
  esperando `&lt;script&gt;` (`templateRender.test.ts:80-84`).
- ⚠️ **Resíduo:** o `subject` é interpolado sem escape e sem sanitização de `\r\n`. Nos providers
  atuais o risco é baixo (Resend e SES são API JSON; nodemailer codifica header), mas um teste que
  trave "subject com quebra de linha não vira header novo" é barato e fecha o assunto.
- Variáveis são allowlist por `key`, não expressão livre. `{{campo}}` e nada mais — que já é o
  contrato do renderer default.

Nada disso passa por `innerHTML` na UI. O preview renderiza texto.

### 1.6 Preview em dois viewports, lado a lado

Hoje o preview é um par de `<p>` em [`NotificationSettingsWorkspace.tsx:225-229`], texto puro,
sem largura nenhuma — e o campo `html` que o `renderTemplate` produz para e-mail **não é usado por
ninguém**. Quem edita não vê o que o destinatário vê.

O painel passa a mostrar **dois quadros simultâneos**, desktop e mobile, do mesmo template.

**Por que lado a lado e não um seletor.** O erro que este preview existe para pegar é a mensagem
que cabe num viewport e quebra no outro: assunto que o cliente de e-mail corta em 78 caracteres no
celular e mostra inteiro no desktop, corpo de push que some depois de duas linhas, rótulo de botão
de WhatsApp que estoura os 20 caracteres. Com um seletor, o operador vê um estado por vez e não
compara — que é justamente a operação que revela o problema.

**Largura é do canal, não do dispositivo.** Uma constante em `notification-contracts`:

| Canal | desktop | mobile | O que o preview precisa reproduzir além da largura |
|---|---|---|---|
| `email` | 600px | 375px | quebra de linha, e o corte do assunto na lista da caixa de entrada |
| `push` | 360px | 375px | limite de título e corpo por plataforma — o corte, não só a largura |
| `whatsapp` | 400px | 375px | teto de 20 caracteres em botão e 24 em linha de lista (`conversation-flow.md` §2) |
| `inbox` | 480px | 375px | o card do próprio produto |
| `sms` | — | 375px | segmentação em 160 caracteres |

Os números vivem em `PREVIEW_VIEWPORT_BY_CHANNEL`, não soltos no CSS — a UI do host precisa deles
para montar o próprio preview pela camada headless.

**O truncamento é o conteúdo do preview.** Mostrar a mesma string em duas larguras diferentes só
prova que CSS quebra texto. O que paga é o preview aplicar os limites reais do canal e **marcar
visivelmente onde cortou**. Isso significa que `renderTemplate` ganha, ao lado de `title`/`body`,
um `constraints: { field, limit, actual, exceeded }[]` — informação que o editor também usa para
avisar antes de salvar, não só para desenhar.

**Nada de `innerHTML`.** O `html` do e-mail é saída de `escapeTemplateHtml`, então a única tag que
sobra é `<br>`. O componente quebra a string por `<br>` e monta nós de texto com `<br/>` entre eles
— não `dangerouslySetInnerHTML`, mesmo com o conteúdo escapado. No dia em que templates HTML ricos
entrarem, a substituição é `<iframe sandbox>` com `srcdoc`, nunca relaxar essa regra.

**Camada headless primeiro.** `useTemplateEditor` passa a devolver
`previews: { viewport: 'desktop' | 'mobile', width: number, rendered: RenderedTemplatePreview }[]`.
O componente pronto desenha os dois quadros; o host com design system próprio consome o array e
desenha do jeito dele — que é a razão de a camada headless existir neste pacote.

**Acessibilidade e responsividade do próprio painel.** Os dois quadros ficam lado a lado a partir
de `desktop:` e empilham abaixo disso (`web.md` §10) — um painel de preview com scroll horizontal
seria irônico. Cada quadro tem rótulo textual ("Desktop 600px" / "Mobile 375px"), não só a
diferença visual de largura.

### 1.7 Variáveis são catálogo declarado, não campo livre

Hoje `{{campo}}` funciona, mas ninguém diz **quais campos existem**. O operador digita
`{{nomeCliente}}` onde o produto envia `{{customerName}}`, o `interpolateTemplate` devolve string
vazia (é o comportamento correto e documentado), e a mensagem sai com um buraco. Nada falha, nada
loga, e o erro só aparece quando o cliente recebe "Olá , seu pedido". Um painel sem catálogo
transforma esse erro de raro em rotineiro, porque passa a haver muito mais gente digitando.

`extractTemplatePlaceholders` já existe no contracts (`templateRender.ts:44`), está exportado no
`index.ts:125` — e **não é consumido por ninguém**. Foi escrito para isto.

**O catálogo é do host, e é código.** Quem sabe que `order.ready` manda `orderNumber` e
`customerName` é o produto que chama `sendNotification`, não o banco e não o operador. Entra na
config do módulo:

```ts
createNotificationModule({
  config: {
    templateVariables: {
      'order.ready': [
        { name: 'orderNumber',  example: 'QC-1042',  required: true },
        { name: 'customerName', example: 'Ana',      required: true },
        { name: 'pickupCode',   example: '4417',     required: false },
      ],
    },
  },
})
```

**Deixar o operador criar variável seria o pior dos dois mundos**: ele inventaria um nome que o
`sendNotification` nunca preenche, e o resultado é exatamente o buraco silencioso que o catálogo
existe para eliminar. Adicionar variável ao *template* é operação de painel; adicionar variável ao
*catálogo* é mudança de código, com deploy — porque é mudança no que o produto emite.

**Validação no `upsert`, servidor.** Placeholder fora do catálogo da `key` recusa com
`400 NOTIFICATION_TEMPLATE_UNKNOWN_VARIABLE`, e o erro nomeia **todas** as variáveis desconhecidas
de uma vez, com `details[]` por campo (`apis.md`) — não a primeira. `key` sem catálogo declarado
não é recusada: mantém o comportamento atual, senão quem já usa o módulo quebra no próximo deploy.

**Variável `required` ausente do corpo é aviso, não bloqueio.** Um push curto pode legitimamente
omitir o `customerName` que o e-mail usa. O aviso aparece no editor; o salvamento passa.

**Sem expressão, sem filtro, sem lógica.** `{{nome}}` e nada mais — o `PLACEHOLDER_PATTERN` já
restringe a `[a-zA-Z0-9_]`. Condicional e formatação em template editável por painel viram uma
linguagem que ninguém projetou e que roda sobre entrada de usuário. Formatação de moeda, data e
plural é responsabilidade de quem monta o payload.

**Na tela:** as variáveis da `key` aparecem como lista clicável ao lado do editor; clicar insere
`{{nome}}` na posição do cursor. O operador nunca digita o nome à mão — erro de digitação é
justamente o modo de falha que isto conserta. Cada item mostra o `example`, que é o mesmo valor que
o preview (§1.6) usa. Variável já usada no corpo fica marcada, e variável `required` ainda não
usada fica destacada.

**No contracts:** `extractTemplatePlaceholders` sai do limbo e ganha
`diffTemplateVariables({ body, subject, catalog })` → `{ unknown[], missingRequired[], used[] }` —
uma função pura, usada pela validação do servidor **e** pelo aviso da tela. Mesma regra nos dois
lados, uma implementação só, pelo mesmo motivo que o preview mora no contracts.

## 2. Contrato de API (adições)

```
DELETE /notification-templates/:id     → 204, grava active=false
GET    /notification-category-policies → { data: [{category, channel, enabled}] }
PUT    /notification-category-policies → substitui o conjunto da empresa
```

`companyId` sempre do contexto autenticado (`requireUser.ts`), nunca do corpo. `DELETE` é
idempotente: desativar template já inativo responde 204.

Erros com código estável por domínio: `NOTIFICATION_TEMPLATE_NOT_FOUND`,
`NOTIFICATION_TEMPLATE_IDENTITY_IMMUTABLE`, `NOTIFICATION_TEMPLATE_UNKNOWN_VARIABLE`.

## 3. Fases

| # | Fase | Entrega | Modelo |
|---|---|---|---|
| 1 | ~~Escape de HTML no `email`~~ | ✅ já implementado e testado. Resta só o teste de CRLF no `subject` | `haiku` |
| 2 | Desativação | use-case, rota `DELETE`, método no client, `useDeactivateTemplate`, skip com razão no envio | `sonnet` |
| 3 | Criação | `useTemplateEditor.startNew()`, identidade travada em edição, `previewPayloadByKey` | `sonnet` |
| 4 | Política por categoria | migration, repositório, use-cases, rotas, integração no `planDeliveries` | `opus` 🧠 |
| 3.5 | Catálogo de variáveis: `templateVariables` na config, `diffTemplateVariables` no contracts, validação no `upsert`, lista clicável no editor | `sonnet` |
| 4.5 | Preview desktop + mobile lado a lado (constantes de viewport, `constraints` no render, `previews[]` no hook, dois quadros na tela) | `sonnet` |
| 5 | UI + locales | botões de criar/remover na `NotificationSettingsWorkspace`, ícones, pt-BR + en | `haiku` |

SMS fica fora: o canal existe no contrato mas não há provider (`packages/backend/` tem
`email-provider`, `push-provider`, `meta-whatsapp-provider` — nenhum de SMS). Criar template de
SMS pelo painel produziria template que nunca sai. Ou entra um `sms-provider` como fase própria,
ou o painel esconde o canal enquanto não houver provider registrado — recomendo o segundo, e é
barato: a lista de canais da UI já vem do host por prop.

## 4. Aceite

- [x] Interpolação em canal `email` escapa HTML, com teste de payload hostil
- [ ] `subject` com `\r\n` não produz header extra
- [ ] Criar template com `key` inédita cria linha; identidade travada ao editar existente
- [ ] Remover desativa e some da lista; template desativado não é usado no envio, e o canal
      é pulado com razão registrada, não com erro
- [ ] Política de categoria restringe canal mesmo com preferência do usuário habilitada
- [ ] Teste negativo de isolamento por `companyId` nas rotas novas (padrão de `isolation.test.ts`)
- [ ] Preview idêntico ao envio, garantido por usar `renderTemplate` e não uma segunda cópia
- [ ] Placeholder fora do catálogo recusa no `upsert`, nomeando todas as variáveis desconhecidas
- [ ] `key` sem catálogo declarado continua aceitando qualquer placeholder
- [ ] `required` ausente do corpo avisa e deixa salvar
- [ ] Clicar na variável insere `{{nome}}` na posição do cursor
- [ ] Preview mostra desktop e mobile simultaneamente, com largura por canal e rótulo textual
- [ ] Texto que estoura o limite do canal aparece truncado e marcado nos dois quadros
- [ ] Nenhum `dangerouslySetInnerHTML` no caminho do preview
- [ ] Os dois quadros empilham abaixo de `desktop:` sem scroll horizontal
- [ ] Canal sem provider registrado não aparece no painel
