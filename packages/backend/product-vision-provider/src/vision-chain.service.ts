/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Encadeia engines de visao. **Funde as leituras em vez de parar na primeira**, e essa e a
 * diferenca em relacao ao `createTranscriberChain`: la os engines sao alternativas para a mesma
 * pergunta, e o primeiro que responde ganha. Aqui eles respondem perguntas diferentes — um le o
 * codigo de barras, outro produz o vetor — e a leitura completa e a soma das duas.
 *
 * Parar no primeiro que devolvesse `barcode` economizaria a inferencia do CLIP e quebraria o
 * caminho que mais importa: codigo lido cujo GTIN ninguem cadastrou. O consumidor cai para a busca
 * vetorial exatamente ali, e cairia num vetor que nunca foi gerado.
 */

import { VisionError } from './product-vision.error'
import type { ProductVisionEngine, VisionInput, VisionReading } from './product-vision.types'

/** Assinatura estrutural do desempatador — igual as outras portas, para nao acoplar ao engine. */
export type VisionRanker = Readonly<{
  rank: (params: {
    readonly image: VisionInput
    readonly candidates: readonly { productId: string; name: string }[]
  }) => Promise<{ readonly productId?: string; readonly engine: string }>
}>

export type VisionChainConfig = Readonly<{
  /**
   * Desempate opcional. Sem ele a cadeia nao expoe `rank`, e o consumidor devolve os candidatos
   * para a pessoa escolher — que e o comportamento correto e o mais barato.
   */
  ranker?: VisionRanker
  /**
   * Observabilidade da degradacao. Sem isto, o engine de vetor cair e invisivel: a leitura continua
   * voltando com o codigo de barras, tudo parece funcionar, e ninguem descobre que a busca visual
   * esta fora ha uma semana.
   */
  onEngineFailure?: (error: unknown, details: { engine: string; isLast: boolean }) => void
}>

export function createVisionChain(
  engines: readonly ProductVisionEngine[],
  config: VisionChainConfig = {},
): ProductVisionEngine {
  if (engines.length === 0) {
    throw new VisionError('A cadeia precisa de pelo menos um engine.', 'chain', false)
  }

  const [only] = engines
  // Um engine so: devolve ele mesmo. Envolver custaria um try/catch e um nome de cadeia no
  // resultado, escondendo qual engine realmente respondeu.
  //
  // Com desempatador nao: ele precisa ser anexado, e o engine sozinho nao o carrega.
  if (engines.length === 1 && only && !config.ranker) return only

  const name = `chain(${engines.map((engine) => engine.name).join('+')})`

  // A cadeia so pode declarar um modelo de embedding, e e o do primeiro engine que tem um: o
  // consumidor guarda vetor num indice de dimensao unica, e dois engines vetoriais na mesma cadeia
  // produziriam vetores incomparaveis sob o mesmo rotulo.
  const embeddingModel = engines.find((engine) => engine.embeddingModel)?.embeddingModel

  async function read(input: VisionInput): Promise<VisionReading> {
    const merged: { barcode?: string; embedding?: readonly number[] } = {}
    const responded: string[] = []
    const failures: unknown[] = []

    for (const [index, engine] of engines.entries()) {
      try {
        const reading = await engine.read(input)
        // Primeiro que preenche cada campo ganha: a ordem da cadeia e a prioridade declarada, e
        // sobrescrever faria o ultimo engine mandar, invertendo o que o consumidor configurou.
        if (reading.barcode && !merged.barcode) merged.barcode = reading.barcode
        if (reading.embedding && !merged.embedding) merged.embedding = reading.embedding
        responded.push(engine.name)
      } catch (error) {
        failures.push(error)
        config.onEngineFailure?.(error, { engine: engine.name, isLast: index === engines.length - 1 })
      }
    }

    // Um engine vivo basta: leitura parcial e util (so o codigo, ou so o vetor). Falha e quando
    // nenhum respondeu — ai nao ha leitura, e engolir isso devolveria "nada encontrado" para o
    // cliente enquanto a causa e infraestrutura fora do ar.
    if (responded.length === 0) throw pickFailureToPropagate(failures)

    return { ...merged, engine: responded.join('+') }
  }

  return Object.freeze({
    name,
    ...(embeddingModel ? { embeddingModel } : {}),
    read,
    // A ausencia de `rank` e o que faz o consumidor cair na escolha manual: capacidade por
    // ausencia, igual ao resto do ecossistema.
    ...(config.ranker ? { rank: config.ranker.rank } : {}),
  })
}

/** Erro retriavel tem prioridade: e o que faz o consumidor tentar de novo em vez de desistir. */
function pickFailureToPropagate(failures: readonly unknown[]): unknown {
  const retriable = failures.find((failure) => failure instanceof VisionError && failure.retriable)
  return retriable ?? failures[0] ?? new VisionError('Nenhum engine respondeu.', 'chain', false)
}
