# Rodando só com Postgres (sem Redis)

O módulo não exige Redis. As portas de infraestrutura do webhook podem ser atendidas pelo mesmo
Postgres que já guarda o schema `meta_whatsapp`:

| Porta | Precisa de | Com Postgres |
|---|---|---|
| Verificação do webhook (`webhook.verifyChallenge`) | nada | função pura: compara o token e devolve o `challenge` |
| `NonceStoreInterface` (anti-replay) | `setIfAbsent` atômico com prazo + `confirm` | `INSERT … ON CONFLICT … WHERE expires_at < now()` |
| `InboundDispatchQueueInterface` (efeitos fora da requisição) | durabilidade + retentativa com backoff + `jobId` único | tabela de jobs + worker com `FOR UPDATE SKIP LOCKED` |
| `CacheInterface` (cache de grafos) | opcional | não configure — `features.flowGraphCache` fica desligado |

As tabelas abaixo são **do host**, não do módulo: ficam nas migrations do produto, no schema dele.
Os exemplos usam o cliente `postgres` (postgres.js); o SQL é o mesmo em qualquer driver.

## Tabelas

```sql
CREATE TABLE IF NOT EXISTS whatsapp_webhook_nonces (
  key        text PRIMARY KEY,
  expires_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS whatsapp_inbound_jobs (
  job_id           text PRIMARY KEY,
  -- empresa + número: jobs da mesma conversa rodam um de cada vez, na ordem de chegada.
  conversation_key text NOT NULL,
  payload          jsonb NOT NULL,
  attempts         integer NOT NULL DEFAULT 0,
  run_at           timestamptz NOT NULL DEFAULT now(),
  created_at       timestamptz NOT NULL DEFAULT clock_timestamp(),
  -- "pego por um worker até": lease curto; worker que morre libera o job quando o prazo vence.
  taken_until      timestamptz,
  last_error       text
);
CREATE INDEX IF NOT EXISTS whatsapp_inbound_jobs_run_at ON whatsapp_inbound_jobs (run_at);
CREATE INDEX IF NOT EXISTS whatsapp_inbound_jobs_conversation ON whatsapp_inbound_jobs (conversation_key, created_at);
```

Limpeza: remover periodicamente as linhas de `whatsapp_webhook_nonces` com `expires_at < now()`.
Chave vencida não atrapalha (o `setIfAbsent` a reaproveita), só ocupa espaço.

## Nonce store

```ts
import type { NonceStoreInterface } from '@adatechnology/meta-whatsapp-module'

export function createPostgresNonceStore(sql: postgres.Sql): NonceStoreInterface {
  return {
    // Insere, ou retoma uma chave já vencida. Linha devolvida = a chave agora é desta entrega.
    async setIfAbsent(key, ttlSeconds) {
      const rows = await sql`
        INSERT INTO whatsapp_webhook_nonces (key, expires_at)
        VALUES (${key}, now() + make_interval(secs => ${ttlSeconds}))
        ON CONFLICT (key) DO UPDATE SET expires_at = EXCLUDED.expires_at
          WHERE whatsapp_webhook_nonces.expires_at < now()
        RETURNING key`
      return rows.length === 1
    },
    async confirm(key, ttlSeconds) {
      await sql`
        UPDATE whatsapp_webhook_nonces
        SET expires_at = now() + make_interval(secs => ${ttlSeconds})
        WHERE key = ${key}`
    },
  }
}
```

A atomicidade vem do `ON CONFLICT`: duas entregas simultâneas da mesma chave disputam a mesma linha,
e só uma recebe `RETURNING`.

## Fila de efeitos

Três cuidados que uma fila "um job por vez" ingênua não tem:

- **Ordem por conversa.** Duas mensagens do mesmo cliente não podem rodar em paralelo nem fora de
  ordem: a segunda responderia ao nó em que a primeira ainda não chegou. O worker só pega o job mais
  antigo pendente de cada `conversation_key`.
- **Nada de rede dentro da transação.** O efeito chama a Meta e o host; segurar a linha travada
  durante isso prende conexão e bloqueia a tabela. A transação só marca o job como pego
  (`taken_until`, um lease) e termina; o efeito roda fora; uma segunda escrita conclui ou reagenda.
- **Sem ticks sobrepostos.** `setInterval` dispara de novo enquanto o tick anterior ainda roda; use
  um laço que espera o anterior terminar.

```ts
import type { InboundDispatchJob, InboundDispatchQueueInterface } from '@adatechnology/meta-whatsapp-module'

const MAX_ATTEMPTS = 8
const LEASE_SECONDS = 120

function conversationKeyOf(job: InboundDispatchJob): string {
  const whatsappNumber = job.kind === 'message' ? job.message.from : job.whatsappNumber
  return `${job.companyId}:${whatsappNumber}`
}

export function createPostgresInboundQueue(sql: postgres.Sql): InboundDispatchQueueInterface {
  return {
    // `jobId` estável: reentrega da Meta cai no ON CONFLICT e não roda o efeito duas vezes.
    async enqueue(job, options) {
      await sql`
        INSERT INTO whatsapp_inbound_jobs (job_id, conversation_key, payload)
        VALUES (${options.jobId}, ${conversationKeyOf(job)}, ${sql.json(job)})
        ON CONFLICT (job_id) DO NOTHING`
    },
  }
}

/** Pega um job (transação curta, sem rede): o mais antigo da conversa, se nada dela estiver em curso. */
async function claimNextJob(sql: postgres.Sql) {
  const [row] = await sql`
    UPDATE whatsapp_inbound_jobs AS job
    SET taken_until = now() + make_interval(secs => ${LEASE_SECONDS})
    WHERE job.job_id = (
      SELECT candidate.job_id FROM whatsapp_inbound_jobs AS candidate
      WHERE candidate.run_at <= now()
        AND candidate.attempts < ${MAX_ATTEMPTS}
        AND (candidate.taken_until IS NULL OR candidate.taken_until < now())
        AND NOT EXISTS (
          SELECT 1 FROM whatsapp_inbound_jobs AS older
          WHERE older.conversation_key = candidate.conversation_key
            AND older.created_at < candidate.created_at
            AND older.attempts < ${MAX_ATTEMPTS}
        )
      ORDER BY candidate.run_at
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    RETURNING job.job_id, job.payload, job.attempts`
  return row
}

// Um job por chamada. O efeito roda FORA de qualquer transação.
export async function processNextInboundJob(params: {
  sql: postgres.Sql
  process: (job: InboundDispatchJob) => Promise<void>
}): Promise<boolean> {
  const row = await claimNextJob(params.sql)
  if (!row) return false
  try {
    await params.process(row.payload as InboundDispatchJob)
    await params.sql`DELETE FROM whatsapp_inbound_jobs WHERE job_id = ${row.job_id}`
  } catch (error) {
    // Backoff exponencial: 3s, 6s, 12s… Esgotadas as tentativas, a linha fica para alerta — e segura
    // os jobs seguintes da mesma conversa até alguém resolver, que é o certo: pular faria o bot
    // responder fora de ordem.
    await params.sql`
      UPDATE whatsapp_inbound_jobs
      SET attempts = attempts + 1,
          taken_until = NULL,
          run_at = now() + make_interval(secs => ${3 * 2 ** row.attempts}),
          last_error = ${error instanceof Error ? error.name : 'unknown error'}
      WHERE job_id = ${row.job_id}`
  }
  return true
}
```

O lease precisa ser maior que o efeito mais lento (rede da Meta + hooks); um efeito que passa do prazo
pode ser pego por outro worker. Dois workers na mesma conversa nunca rodam juntos: o `NOT EXISTS`
olha o job mais antigo pendente, e ele só sai da tabela quando conclui.

O `payload` é a mensagem **crua** do cliente (ver `features.redactInboundLocation`): trate a tabela
com a mesma regra de retenção do transcript, e nunca registre `last_error` com o corpo da mensagem (o exemplo guarda só o nome do erro).
Recusa determinística da Meta não chega ao `catch`: `processInboundDispatch` a entrega em
`onInboundEffectRejected` e conclui o job, para a fila não reenviar o que já saiu.

## Ligando no módulo

```ts
const whatsapp = createMetaWhatsAppModule({
  db,
  config,
  nonceStore: createPostgresNonceStore(sql),
  providers: { inboundQueue: createPostgresInboundQueue(sql) },
  hooks,
})

// No worker (mesmo processo ou outro). Um laço, não setInterval: o próximo tick só começa quando o
// anterior terminou, então dois ticks nunca disputam a mesma conversa no mesmo processo.
let isStopping = false
process.once('SIGTERM', () => (isStopping = true))

async function runInboundWorker(): Promise<void> {
  while (!isStopping) {
    const hasProcessed = await processNextInboundJob({
      sql,
      process: (job) => whatsapp.webhook.processInboundDispatch.execute(job),
    })
    if (!hasProcessed) await new Promise((resolve) => setTimeout(resolve, 1_000))
  }
}
void runInboundWorker()
```

Os requisitos de `docs/webhook-durability.md` continuam valendo: alerta quando `attempts` chega ao
máximo, `5xx` no webhook em falha, drain no `SIGTERM`.
