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
  job_id     text PRIMARY KEY,
  payload    jsonb NOT NULL,
  attempts   integer NOT NULL DEFAULT 0,
  run_at     timestamptz NOT NULL DEFAULT now(),
  last_error text
);
CREATE INDEX IF NOT EXISTS whatsapp_inbound_jobs_run_at ON whatsapp_inbound_jobs (run_at);
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

```ts
import type { InboundDispatchJob, InboundDispatchQueueInterface } from '@adatechnology/meta-whatsapp-module'

export function createPostgresInboundQueue(sql: postgres.Sql): InboundDispatchQueueInterface {
  return {
    // `jobId` estável: reentrega da Meta cai no ON CONFLICT e não roda o efeito duas vezes.
    async enqueue(job, options) {
      await sql`
        INSERT INTO whatsapp_inbound_jobs (job_id, payload)
        VALUES (${options.jobId}, ${sql.json(job)})
        ON CONFLICT (job_id) DO NOTHING`
    },
  }
}

const MAX_ATTEMPTS = 8

// Um job por chamada; rode em laço (setInterval, ou LISTEN/NOTIFY para acordar mais cedo).
export async function processNextInboundJob(params: {
  sql: postgres.Sql
  process: (job: InboundDispatchJob) => Promise<void>
}): Promise<boolean> {
  return params.sql.begin(async (transaction) => {
    const [row] = await transaction`
      SELECT job_id, payload, attempts FROM whatsapp_inbound_jobs
      WHERE run_at <= now() AND attempts < ${MAX_ATTEMPTS}
      ORDER BY run_at
      LIMIT 1
      FOR UPDATE SKIP LOCKED`
    if (!row) return false
    try {
      await params.process(row.payload as InboundDispatchJob)
      // Concluído: o job sai da tabela (DELETE pela chave job_id).
      await transaction`DELETE FROM whatsapp_inbound_jobs WHERE job_id = ${row.job_id}`
    } catch (error) {
      // Backoff exponencial: 3s, 6s, 12s… Esgotadas as tentativas, a linha fica para alerta.
      await transaction`
        UPDATE whatsapp_inbound_jobs
        SET attempts = attempts + 1,
            run_at = now() + make_interval(secs => ${3 * 2 ** row.attempts}),
            last_error = ${error instanceof Error ? error.message : 'unknown error'}
        WHERE job_id = ${row.job_id}`
    }
    return true
  })
}
```

O `payload` é a mensagem **crua** do cliente (ver `features.redactInboundLocation`): trate a tabela
com a mesma regra de retenção do transcript, e nunca registre `last_error` com o corpo da mensagem.

## Ligando no módulo

```ts
const whatsapp = createMetaWhatsAppModule({
  db,
  config,
  nonceStore: createPostgresNonceStore(sql),
  providers: { inboundQueue: createPostgresInboundQueue(sql) },
  hooks,
})

// No worker (mesmo processo ou outro):
setInterval(async () => {
  while (await processNextInboundJob({ sql, process: (job) => whatsapp.webhook.processInboundDispatch.execute(job) })) {}
}, 1_000)
```

Os requisitos de `docs/webhook-durability.md` continuam valendo: alerta quando `attempts` chega ao
máximo, `5xx` no webhook em falha, drain no `SIGTERM`.
