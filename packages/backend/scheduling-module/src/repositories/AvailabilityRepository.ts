/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { and, gt, lt, sql } from 'drizzle-orm'

import type { SchedulingDatabase } from '../database.types'
import {
  availabilityExceptions,
  availabilityRules,
  resources,
  type AvailabilityExceptionRow,
  type AvailabilityRuleRow,
  type NewAvailabilityExceptionRow,
  type NewAvailabilityRuleRow,
} from '../schema/schema'
import {
  availabilityExceptionListCondition,
  availabilityExceptionOwnedByCondition,
  availabilityRuleListCondition,
  availabilityRuleOwnedByCondition,
  resourceOwnedByCondition,
} from './conditions'

export class AvailabilityRepository {
  constructor(private readonly db: SchedulingDatabase) {}

  async createRule(values: NewAvailabilityRuleRow): Promise<AvailabilityRuleRow> {
    const [row] = await this.db.insert(availabilityRules).values(values).returning()
    if (!row) throw new Error('scheduling-module: insert em availability_rules não retornou linha')
    return row
  }

  async listRulesByResource(params: { companyId: string; resourceId: string }): Promise<AvailabilityRuleRow[]> {
    return this.db.select().from(availabilityRules).where(availabilityRuleListCondition(params))
  }

  async deleteRule(params: { companyId: string; id: string }): Promise<boolean> {
    const [row] = await this.db
      .delete(availabilityRules)
      .where(availabilityRuleOwnedByCondition(params))
      .returning({ id: availabilityRules.id })
    return row !== undefined
  }

  /**
   * Substitui todas as regras do recurso na mesma transação (apaga + insere) — nunca uma janela
   * onde o recurso fica sem regra nenhuma se o processo cair no meio (molde de
   * `BookingRepository.rescheduleWithSlotReplace`).
   */
  async replaceRules(params: {
    companyId: string
    resourceId: string
    rules: ReadonlyArray<Omit<NewAvailabilityRuleRow, 'companyId' | 'resourceId'>>
  }): Promise<AvailabilityRuleRow[]> {
    return this.db.transaction(async (tx) => {
      await tx.delete(availabilityRules).where(availabilityRuleListCondition(params))
      if (params.rules.length === 0) return []
      return tx
        .insert(availabilityRules)
        .values(params.rules.map((rule) => ({ ...rule, companyId: params.companyId, resourceId: params.resourceId })))
        .returning()
    })
  }

  async createException(values: NewAvailabilityExceptionRow): Promise<AvailabilityExceptionRow> {
    const [row] = await this.db.insert(availabilityExceptions).values(values).returning()
    if (!row) throw new Error('scheduling-module: insert em availability_exceptions não retornou linha')
    return row
  }

  async deleteException(params: { companyId: string; id: string }): Promise<boolean> {
    const [row] = await this.db
      .delete(availabilityExceptions)
      .where(availabilityExceptionOwnedByCondition(params))
      .returning({ id: availabilityExceptions.id })
    return row !== undefined
  }

  /**
   * Janela `[from, until)` — o cálculo de disponibilidade em leitura (Fase 3) soma/subtrai estas
   * linhas contra a regra semanal, nunca materializa slot (spec §7).
   *
   * F-014: `from`/`until` são opcionais porque a tela de gestão de exceções (`ListAvailability-
   * ExceptionsUseCase`) precisa do histórico inteiro do recurso, não só o que cai numa janela de
   * busca — mas o cálculo de disponibilidade (`ListAvailableSlotsUseCase`) sempre passa os dois.
   * Sem o filtro, uma exceção `extra` de qualquer data (passada ou anos no futuro) virava
   * candidato de slot reservável em toda consulta de disponibilidade do recurso, porque nada
   * comparava `duringStart`/`duringEnd` contra a janela pedida — o nome do método prometia o
   * filtro desde o começo, mas ele nunca foi implementado.
   */
  async listExceptionsByResourceInRange(params: {
    companyId: string
    resourceId: string
    from?: Date
    until?: Date
  }): Promise<AvailabilityExceptionRow[]> {
    const listCondition = availabilityExceptionListCondition(params)
    const where =
      params.from && params.until
        ? and(
            listCondition,
            lt(availabilityExceptions.duringStart, params.until),
            gt(availabilityExceptions.duringEnd, params.from),
          )!
        : listCondition
    return this.db.select().from(availabilityExceptions).where(where)
  }

  /**
   * Hora de parede (`HH:mm`) → instante, pelo fuso do próprio recurso — via `AT TIME ZONE` do
   * Postgres, nunca offset fixo calculado no código (spec §5.3, T3.2). É a única conversão do
   * módulo que depende de Postgres real: `(data + hora) AT TIME ZONE zona` resolve o deslocamento
   * certo mesmo quando a data cai do outro lado de uma virada de horário de verão.
   *
   * F-008: resolve N pares `(localDate, localTime)` numa única viagem ao Postgres —
   * `ListAvailableSlotsUseCase` resolvia início e fim de cada ocorrência de regra com uma chamada
   * por par, virando N+1 idas ao banco numa janela de disponibilidade de semanas. `unnest`
   * decompõe os arrays em linhas dentro da própria query; a chave do mapa devolvido é
   * `localDate|localTime`, a mesma formada em `resolveLocalInstantsKey`.
   */
  async resolveLocalInstants(params: {
    companyId: string
    resourceId: string
    occurrences: ReadonlyArray<{ localDate: string; localTime: string }>
  }): Promise<Map<string, Date>> {
    if (params.occurrences.length === 0) return new Map()

    // Uma linha `VALUES` por ocorrência, cada uma com 3 parâmetros escalares (`date`, `time`,
    // `ord`) — nunca um array ligado a `unnest(...)::date[]`. Duas tentativas anteriores
    // mostraram por que: interpolar o array puro (`${array}`) faz o drizzle expandi-lo em
    // `(p1, p2, ...)`, e o cast `::date[]` seguinte vira "cannot cast type record to date[]"; e
    // `sql.param(array)` embrulha o array como um parâmetro só, mas o driver `bun-sql` serializa
    // esse parâmetro como texto separado por vírgula (`2027-04-07,2027-04-14`), não como literal
    // de array do Postgres (`{2027-04-07,2027-04-14}`) — `array_in` rejeita com "malformed array
    // literal". Confirmado contra Postgres real, não só lendo o driver. `VALUES` com parâmetro
    // escalar por célula é o mesmo binding que já funciona no resto do módulo.
    const valuesRows = sql.join(
      params.occurrences.map(
        (occurrence, index) => sql`(${occurrence.localDate}::date, ${occurrence.localTime}::time, ${index + 1})`,
      ),
      sql`, `,
    )

    // `ord` volta cada linha ao par original por posição, em vez de reconstruir a chave a
    // partir do texto que o Postgres devolve — `pair.local_time::text` sai `09:00:00` (com
    // segundos) e nunca bate com a chave `09:00` montada a partir da regra.
    const result = await this.db.execute(sql`
      select pair.ord as ord,
             (pair.local_date + pair.local_time) AT TIME ZONE ${resources.timezone} as instant
      from (values ${valuesRows}) as pair(local_date, local_time, ord), ${resources}
      where ${resourceOwnedByCondition({ companyId: params.companyId, id: params.resourceId })}
    `)

    // O shape de `execute()` varia por driver (`postgres`/bun-sql devolvem o array de linhas
    // direto, `node-postgres` embrulha em `.rows`) — `SchedulingDatabase` é intencionalmente
    // agnóstico de driver (`database.types.ts`), então os dois formatos são aceitos aqui.
    const rows = (Array.isArray(result) ? result : (result as unknown as { rows: unknown[] }).rows) as Array<{
      ord: number | string | bigint
      instant: Date | string
    }>

    const instants = new Map<string, Date>()
    for (const row of rows) {
      const occurrence = params.occurrences[Number(row.ord) - 1]
      if (!occurrence) continue
      instants.set(resolveLocalInstantsKey(occurrence), new Date(row.instant))
    }
    return instants
  }
}

/** Chave do mapa devolvido por `resolveLocalInstants` — mesmo formato usado em `Availability.use-cases.ts`. */
export function resolveLocalInstantsKey(params: { localDate: string; localTime: string }): string {
  return `${params.localDate}|${params.localTime}`
}
