# @adatechnology/recommendation-module

Recomendações de qualquer tipo — lugar, evento, produto, serviço, conteúdo — **patrocinadas** por
um anunciante ou da **curadoria** da equipe. Faz parte do trio:

| pacote | o que tem |
|---|---|
| `@adatechnology/recommendation-contracts` | tipos, schemas zod, erros com status HTTP e portas |
| `@adatechnology/recommendation-module` | schema `recommendation`, migrations, casos de uso e rotas (`module-http`) |
| `@adatechnology/recommendations-ui` | feed com rótulo de patrocinado e rastreio, e a tela de administração |

## Conceitos

- **Item**: o que aparece no card. Campos comuns (título, resumo, imagem, link, cidade, UF, faixa de
  idade, tags) e os campos do **tipo**, declarados pelo produto e gravados em `attributes`.
- **Origem**: `sponsored` exige anunciante (`sponsorId`, tipicamente um cliente do
  `customer-module`); `curated` não aceita anunciante. Patrocinado sempre sai marcado no feed.
- **Campanha**: só em item patrocinado. Plano, prioridade, período e espaços (vazio = todos).
- **Espaço** (placement): onde a tela desenha recomendações. Cada um tem teto de patrocinados.
- **Métricas**: impressões e cliques somados por dia, item, campanha e espaço. Nenhuma linha por
  pessoa: o pacote não guarda quem viu o quê.

## Ordem do feed

1. Patrocinados no ar agora (campanha ativa, no período, no espaço, com assinatura válida), até o
   teto do espaço: peso do plano, depois prioridade, depois sorteio (rodízio entre iguais).
2. Curadoria: mais tags em comum com o pedido, depois a mais recente.
3. Cidade é estrita: quem não informa cidade só vê itens sem cidade. Idade filtra pela faixa.

## Uso no host

```ts
import { createRecommendationModule, createRecommendationRoutes, recommendationMigrationsFolder, RECOMMENDATION_MIGRATIONS_TABLE } from '@adatechnology/recommendation-module'

// migrations: o migrator do driver do host, com a pasta e a tabela do módulo
await migrate(db, { migrationsFolder: recommendationMigrationsFolder(), migrationsTable: RECOMMENDATION_MIGRATIONS_TABLE })

const recommendations = createRecommendationModule({
  db,
  config: {
    tenancy: { mode: 'single' },
    timeZone: 'America/Sao_Paulo',
    kinds: [{ name: 'place', label: 'Lugar', fields: [
      { name: 'category', label: 'Categoria', type: 'select', required: true, options: [{ value: 'parque', label: 'Parque' }] },
    ] }],
    plans: [{ name: 'featured', label: 'Destaque', weight: 10 }, { name: 'basic', label: 'Recomendado', weight: 1 }],
    placements: [{ name: 'home', label: 'Início', maxSponsored: 1 }],
  },
  sponsors: { exists: async ({ sponsorId }) => Boolean(await customers.repositories.customers.findById({ companyId: undefined, id: sponsorId })) },
  // entitlement: { isEntitled: async ({ sponsorId, plan, at }) => billing.hasActive(sponsorId, plan, at) },
})

const routes = createRecommendationRoutes({ module: recommendations })
```

As rotas de administração pedem o escopo `recommendations:admin`; o feed
(`GET /recommendations`) e o rastreio (`POST /recommendations/events`) pedem só usuário autenticado.
**Limite a taxa do rastreio no host**: contador público é contador que se infla.

## Assinatura (futuro)

`CampaignEntitlementPort.isEntitled` é consultada ao criar/reativar campanha (recusa com 402) e a
cada feed (assinatura vencida tira o anúncio do ar sem pausar a campanha). Sem a porta, toda
campanha ativa no período vai ao ar.

## Testes

`bun test`. O teste ponta a ponta usa `RECOMMENDATION_TEST_DATABASE_URL` (ou `DATABASE_URL`) e
aplica o SQL embarcado direto, duas vezes, para provar que o baseline é convergente.
