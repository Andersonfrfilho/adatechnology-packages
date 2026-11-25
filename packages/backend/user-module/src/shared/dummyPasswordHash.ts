/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Hash descartável para o login gastar o mesmo tempo de verificação quando a conta não existe, não
 * tem senha local ou está bloqueada. Sem ele, a resposta rápida do "e-mail desconhecido" revela
 * quais e-mails têm conta.
 */

let dummyHashPromise: Promise<string> | undefined

function getDummyHash(): Promise<string> {
  dummyHashPromise ??= Bun.password.hash(crypto.randomUUID())
  return dummyHashPromise
}

/** Sempre `false`; existe só pelo custo de CPU. */
export async function verifyAgainstDummyHash(password: string): Promise<false> {
  await Bun.password.verify(password, await getDummyHash())
  return false
}
