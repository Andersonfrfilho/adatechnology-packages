# @adatechnology/infra-ui

**Interface de gestão de infraestrutura em nuvem** — ambientes (ligar e desligar, agenda), custos do ciclo e integração do token do provedor. Camada headless por baixo, tela composta por cima.

- **Provider + hooks headless** para montar a própria tela sobre a mesma lógica
- **InfraWorkspace** — tela composta com as abas Ambientes, Custos e Integração
- **Sem fetch direto** — o host implementa `InfraApi`
- **Capacidade opcional por ausência** — método não implementado não desenha o affordance
- **Sem cor própria** — usa as classes Tailwind do host (`brand-*`, `gray-*`); o Tailwind do host precisa varrer `node_modules/@adatechnology/infra-ui/dist`
- **Provedor neutro** — nenhum nome de provedor nos identificadores; o link de onde gerar o token entra por prop

---

## Instalação

```bash
bun add @adatechnology/infra-ui @adatechnology/infra-contracts
bun add react react-dom @tanstack/react-query lucide-react
```

`@tanstack/react-query` é peer: o pacote usa o `QueryClient` do host. Os tipos e constantes de domínio (estado de acesso, classificação, estado de energia) vêm de `@adatechnology/infra-contracts`.

---

## `InfraApi`

Todos os métodos são opcionais. A tela só desenha o que o host implementa.

```ts
type InfraApi = {
  listEnvironments?(): Promise<ListInfraEnvironmentsResult>
  powerOffEnvironment?(params: { environmentId: string }): Promise<{ operationId: string }>
  powerOnEnvironment?(params: { environmentId: string; keepOnUntil?: string }): Promise<{ operationId: string }>
  getOperation?(params: { operationId: string }): Promise<InfraOperation>
  saveSchedule?(params: SaveEnvironmentScheduleParams): Promise<SaveEnvironmentScheduleResult>
  getCosts?(): Promise<InfraCosts>
  getIntegration?(): Promise<InfraIntegrationView>
  saveIntegration?(params: { token: string; password: string }): Promise<InfraIntegrationView>
  verifyIntegration?(): Promise<{ access: InfraAccessStatus }>
  removeIntegration?(params: { password: string }): Promise<InfraIntegrationView>
}
```

| Método ausente | Efeito na tela |
|---|---|
| `listEnvironments` | aba Ambientes não aparece |
| `powerOnEnvironment` ou `powerOffEnvironment` | cartão do ambiente sem botões de ligar/desligar |
| `saveSchedule` | cartão do ambiente sem o editor de agenda |
| `getCosts` | aba Custos não aparece |
| `getIntegration` | aba Integração não aparece |
| `saveIntegration` | formulário de token não aparece |
| `verifyIntegration` | botão "Verificar acesso" não aparece |
| `removeIntegration` | seção "Remover token" não aparece |

Erros: a tela decide pelo campo `code` do erro lançado (`error.code`), nunca pela mensagem do servidor. O host lança o erro do próprio cliente HTTP; o pacote lê `code` por duck typing.

---

## Uso básico

```tsx
import { InfraProvider, InfraWorkspace, type InfraApi } from '@adatechnology/infra-ui'

const infraApi: InfraApi = {
  listEnvironments: () => http.get('/infra/environments'),
  powerOnEnvironment: ({ environmentId, keepOnUntil }) =>
    http.post(`/infra/environments/${environmentId}/power-on`, keepOnUntil ? { keepOnUntil } : {}),
  powerOffEnvironment: ({ environmentId }) => http.post(`/infra/environments/${environmentId}/power-off`),
  saveSchedule: ({ environmentId, ...body }) => http.put(`/infra/environments/${environmentId}/schedule`, body),
  getCosts: () => http.get('/infra/costs'),
  getIntegration: () => http.get('/infra/integration'),
  saveIntegration: (body) => http.put('/infra/integration', body),
  verifyIntegration: () => http.post('/infra/integration/verify'),
  removeIntegration: (body) => http.delete('/infra/integration', body),
}

export function InfraPage() {
  return (
    <InfraProvider api={infraApi}>
      <InfraWorkspace tokenSource={{ url: 'https://provider.example/tokens', label: 'provider.example/tokens' }} />
    </InfraProvider>
  )
}
```

## `InfraWorkspace`

```ts
type InfraWorkspaceProps = {
  labels?: Partial<InfraWorkspaceLabels>            // title, areaNav, environmentsTab, costsTab, integrationTab
  tokenSource?: { url: string; label: string }      // onde gerar o token; ausente, o link não é desenhado
  renderHeaderActions?: () => ReactNode              // ações do produto no cabeçalho
  renderAboveArea?: (area: InfraWorkspaceArea) => ReactNode  // conteúdo do produto acima da área aberta
  area?: InfraWorkspaceArea                          // área controlada pelo host (query string)
  onAreaChange?: (area: InfraWorkspaceArea) => void
}
```

`INFRA_WORKSPACE_AREA` expõe `ENVIRONMENTS`, `COSTS` e `INTEGRATION`; `isInfraWorkspaceArea(value)` valida strings vindas da URL.

As três áreas também são exportadas separadamente — `EnvironmentsArea`, `CostsArea` e `IntegrationArea` — para o host que as mapeia em rotas próprias (cada uma dentro de um `InfraProvider`).

## Textos

Os textos internos vivem em `locales/pt-BR.json`. O host sobrescreve qualquer chave (merge profundo) pelo provider:

```tsx
<InfraProvider api={infraApi} messages={{ integration: { form: { tokenLabel: 'Token do Acme Cloud' } } }}>
```

## Camada headless

```ts
useInfraEnvironments()          // lista, com polling enquanto há operação em curso
useInfraOperation(operationId)  // acompanha uma operação até terminar
usePowerOnEnvironment()
usePowerOffEnvironment()
useSaveEnvironmentSchedule()
useInfraCosts()
useInfraIntegration()
useSaveInfraIntegration()       // gcTime 0: o cache de mutação não retém token nem senha
useVerifyInfraIntegration()
useRemoveInfraIntegration()
useInfraApi(); useInfraCapabilities(); useInfraMessages()
```

---

## Licença

MIT © Ada Technology
