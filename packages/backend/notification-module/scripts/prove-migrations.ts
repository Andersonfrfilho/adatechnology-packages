/**
 * Prova, contra Postgres real, que `migrations-v1` converge nos cenários de upgrade.
 *
 *   DATABASE_URL=postgres://… DRIZZLE_1X_DIR=<drizzle-orm 1.x> DRIZZLE_045_DIR=<drizzle-orm 0.45> \
 *     bun scripts/prove-migrations.ts <dir com 0.1.0-rc.3/package, 0.1.0-rc.12/package, 0.1.2/package,
 *     0.2.0/package (npm pack de cada versão)> <dist/migrations-v1> [<pasta v1 ingênua: SQL original da rc.3>]
 *
 * Cada cenário cria e descarta um banco próprio. O 3º argumento é o controle negativo: com o SQL
 * original (não idempotente) as pastas de mesmo nome do rc.3 quebram em C e D.
 */
import { SQL } from 'bun'
const M1 = process.env.DRIZZLE_1X_DIR!
// Diretório com drizzle-orm 1.x e com 0.45 (raiz do pacote drizzle-orm de cada um).
const M045 = process.env.DRIZZLE_045_DIR!
const D = process.argv[2]!,
  P = process.argv[3]!,
  N = process.argv[4]
const base = process.env.DATABASE_URL!
const admin = new SQL(base)
const dbName = 'notif_cmp_' + Date.now()
await admin.unsafe(`CREATE DATABASE ${dbName}`)
const u = new URL(base)
u.pathname = '/' + dbName
const url = u.toString()
const { drizzle: d1 } = await import(M1 + '/bun-sql/index.js')
const { migrate: m1 } = await import(M1 + '/bun-sql/migrator.js')
const { drizzle: d045 } = await import(M045 + '/bun-sql/index.js')
const { migrate: m045 } = await import(M045 + '/bun-sql/migrator.js')
const cfg = (f: string) => ({ migrationsFolder: f, migrationsTable: 'notification_migrations' })
const raw = new SQL(url)
const table = async (l: string) =>
  console.log(
    l,
    JSON.stringify(
      (
        await raw.unsafe(
          "select to_jsonb(t) - 'hash' || jsonb_build_object('h', left(hash,12)) r from drizzle.notification_migrations t order by id",
        )
      ).map((x: any) => x.r),
    ),
  )
const schema = async () =>
  (
    await raw.unsafe(
      `select table_name||'.'||column_name c from information_schema.columns where table_schema='notification' order by 1`,
    )
  )
    .map((r: any) => r.c)
    .join(',') +
  ' | ' +
  (
    await raw.unsafe(
      `select conname||':'||confdeltype::text c from pg_constraint where connamespace='notification'::regnamespace and contype='f' order by 1`,
    )
  )
    .map((r: any) => r.c)
    .join(',') +
  ' | idx=' +
  (await raw.unsafe(`select count(*)::int n from pg_indexes where schemaname='notification'`))[0].n
const reset = async () => {
  await raw.unsafe('drop schema if exists notification cascade; drop schema if exists drizzle cascade')
}
const run = async (l: string, f: () => Promise<any>) => {
  try {
    await f()
    console.log(l, 'OK')
  } catch (e: any) {
    console.log(l, 'ERR', (e.cause?.message ?? e.message).slice(0, 160))
  }
}
try {
  const db1 = d1({ client: new SQL(url) }),
    db045 = d045({ client: new SQL(url) })
  console.log('### A: host 1.x com rc.3 aplicado')
  await run('rc.3 apply', () => m1(db1, cfg(D + '/0.1.0-rc.3/package/dist/migrations')))
  await table('after rc.3:')
  const sRc3 = await schema()
  console.log('schema rc.3:', sRc3)
  await run('0.2.0 apply (as-is)', () => m1(db1, cfg(D + '/0.2.0/package/dist/migrations')))
  await run('proposed 0.2.1 apply', () => m1(db1, cfg(P)))
  await table('after 0.2.1:')
  const sA = await schema()
  console.log('schema A:', sA)
  await run('proposed 0.2.1 re-apply', () => m1(db1, cfg(P)))
  await reset()
  console.log('### B: host 1.x novo')
  await run('proposed fresh', () => m1(db1, cfg(P)))
  const sB = await schema()
  console.log('B==A', sB === sA)
  await reset()
  console.log(
    '### C: host 0.45 com 0.1.2 (legacy) -> 0.2.1 legacy folder (bytes iguais) -> depois troca para drizzle 1.x',
  )
  await run('0.45 legacy 0.1.2', () => m045(db045, cfg(D + '/0.1.2/package/dist/migrations')))
  await table('after 0.45:')
  await run('0.45 legacy 0.2.0 (=0.2.1 legacy)', () => m045(db045, cfg(D + '/0.2.0/package/dist/migrations')))
  await run('0.45 given v1 folder', () => m045(db045, cfg(P)))
  await run('1.x upgrade with proposed v1', () => m1(db1, cfg(P)))
  await table('after 1.x upgrade:')
  const sC = await schema()
  console.log('C==A', sC === sA)
  await reset()
  console.log('### D: host 0.45 com rc.12 (0000/0001 nao convergentes, hashes antigos)')
  await run('0.45 rc.12', () => m045(db045, cfg(D + '/0.1.0-rc.12/package/dist/migrations')))
  await run('0.45 0.2.0', () => m045(db045, cfg(D + '/0.2.0/package/dist/migrations')))
  await run('1.x upgrade with proposed v1', () => m1(db1, cfg(P)))
  console.log('D==A', (await schema()) === sA)
  if (N) {
    await reset()
    console.log('### CONTROLE NEGATIVO: SQL original (nao idempotente) no lugar do v1')
    await run('C: 0.45 legacy 0.1.2', () => m045(db045, cfg(D + '/0.1.2/package/dist/migrations')))
    await run('C: 1.x upgrade com SQL original (esperado ERR)', () => m1(db1, cfg(N)))
    await reset()
    await run('D: 0.45 rc.12', () => m045(db045, cfg(D + '/0.1.0-rc.12/package/dist/migrations')))
    await run('D: 1.x upgrade com SQL original (esperado ERR)', () => m1(db1, cfg(N)))
  }
} finally {
  await raw.close()
  await admin.unsafe(`DROP DATABASE ${dbName} WITH (FORCE)`)
  await admin.close()
}
process.exit(0)
