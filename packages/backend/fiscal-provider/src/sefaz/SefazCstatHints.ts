/**
 * Orientações acionáveis para códigos cStat de rejeição da SEFAZ (NF-e / NFC-e).
 *
 * Complementam a `xMotivo` oficial (curta e técnica) com o que o usuário precisa fazer
 * para resolver — principalmente nos casos em que a ação está fora do sistema
 * (credenciamento, CSC, inscrição estadual). Devolvido em `FiscalResult.errorHint`.
 */

export const SEFAZ_CSTAT_HINT: Record<string, string> = {
  '245':
    'CNPJ não credenciado para NFC-e neste ambiente. Credencie no Posto Fiscal Eletrônico (PFE) da SEFAZ do estado (menu NFC-e › Credenciamento), acessando com o certificado da empresa. Atenção: homologação e produção são credenciados separadamente.',
  '462':
    'O Identificador do CSC (cscId) informado não está cadastrado na SEFAZ para este CNPJ neste ambiente. Obtenha o CSC no PFE (NFC-e › Consulta/Gerar CSC) acessando com o certificado da empresa — são dois valores: o Id (número) e o Token (~36 caracteres). Informe o cscId e o cscToken corretos do ambiente em uso (o mesmo par que o portal usa nas notas reais).',
  '209':
    'Inscrição Estadual do emitente inválida ou não habilitada como contribuinte ICMS. Confirme a IE no cadastro do estado (ex.: CADESP em SP) e informe apenas os dígitos, sem pontos/traços. Simples Nacional sem IE: deixe o campo vazio para gerar <IE>ISENTO</IE>.',
  '225':
    'Falha no schema do XML: algum campo está fora do padrão (formato, tamanho ou ausente). Verifique os campos do item/total citados na mensagem da SEFAZ.',
  '252':
    'Ambiente informado (tpAmb) diverge do ambiente do webservice. Garanta que environment ("homologacao" ou "producao") corresponde ao endpoint em uso.',
  '244':
    'Série incompatível com o processo de emissão. Séries 890–899 e 900–999 são reservadas para contingência — use uma série normal (ex.: 1) para emissão pelo aplicativo do contribuinte.',
  '204':
    'Duplicidade: já existe documento autorizado com esta mesma série e número. Avance para o próximo número da sequência.',
  '539':
    'Duplicidade de NF-e com diferença na chave: o número já foi usado com outra chave de acesso. Ajuste o número da nota.',
  '1115':
    'Grupo IBS/CBS (Reforma Tributária, NT 2025.002) não informado. Atualize a biblioteca — o grupo IBS/CBS por item passou a ser obrigatório a partir de 05/01/2026.',
}

/** Devolve a orientação acionável para um cStat, ou undefined se não houver mapeamento. */
export function resolveErrorHint(errorCode?: string, environment?: string): string | undefined {
  if (!errorCode) return undefined
  const hint = SEFAZ_CSTAT_HINT[errorCode.trim()]
  if (!hint) return undefined
  const ambiente = environment === 'producao' ? 'PRODUCAO' : environment === 'homologacao' ? 'HOMOLOGACAO' : undefined
  return ambiente ? `[Ambiente: ${ambiente}] ${hint}` : hint
}
