/**
 * Tipos específicos para Control-ID S@T-iD
 * Integração simplificada com fiscal-provider
 */

export interface ControlIDConfig {
  /** Código de ativação do SAT (6 dígitos) */
  activationCode: string

  /** Assinatura do AC (Ato Constitutivo) */
  signatureAC: string

  /** URL do middleware HTTP (ex: http://localhost:9090) */
  middlewareUrl: string

  /** Timeout em ms para chamadas ao middleware */
  timeout?: number

  /** Log detalhado */
  debug?: boolean
}

/**
 * Configuração de ativação do Control-ID
 * Retorno após ativar o SAT
 */
export interface ControlIDActivationResponse {
  /** Código da resposta: 06000 = sucesso */
  EEEEE: string

  /** Mensagem da operação */
  mensagem: string

  /** Status da ativação */
  statusAtivacao: 'ativado' | 'erro' | 'nao-ativado'

  /** CNPJ vinculado ao SAT */
  cnpj?: string

  /** Número de série do SAT */
  numeroSerie?: string

  /** Data/hora de ativação */
  dataAtivacao?: string
}

/**
 * Status operacional do SAT
 */
export interface ControlIDStatusOperacional {
  /** Código de status */
  EEEEE: string

  /** Descrição do status */
  mensagem: string

  /** Status da comunicação com SEFAZ */
  statusSefaz: 'conectado' | 'desconectado' | 'intermitente'

  /** Última hora de sincronização */
  ultimaSincronizacao?: string

  /** Quantidade de CF-e pendentes */
  cfsePendentes: number

  /** Espaço livre em disco */
  espacoLivre?: string
}

/**
 * Instalação do middleware
 */
export interface ControlIDMiddlewareInstallOptions {
  /** Porta HTTP (padrão: 9090) */
  port?: number

  /** Código de ativação */
  activationCode: string

  /** Diretório de logs (padrão: ./logs) */
  logsDir?: string

  /** Nível de log: debug | info | error */
  logLevel?: 'debug' | 'info' | 'error'

  /** Auto-restart em caso de erro */
  autoRestart?: boolean

  /** Intervalo de reinicialização (ms) */
  restartInterval?: number
}

/**
 * Resposta do middleware de instalação
 */
export interface ControlIDMiddlewareStartResponse {
  /** Porta em que middleware está rodando */
  port: number

  /** PID do processo (se em background) */
  pid?: number

  /** URL do middleware */
  url: string

  /** Status do middleware */
  status: 'running' | 'failed' | 'starting'

  /** Mensagem de status */
  message: string

  /** Função para parar o middleware */
  stop?: () => void

  /** Função para verificar saúde */
  health?: () => Promise<{ status: 'ok' | 'error' }>
}

/**
 * Configuração de emissão SAT
 * Estende SatConfig com dados específicos de Control-ID
 */
export interface ControlIDEmissaoConfig {
  /** Código de ativação */
  activationCode: string

  /** Ambiente: homologacao ou producao */
  environment: 'homologacao' | 'producao'

  /** Assinatura AC */
  signatureAC: string

  /** CNPJ do emitente (sem formatação) */
  cnpj: string

  /** Razão social */
  razaoSocial: string

  /** UF do emitente */
  uf: string

  /** Município */
  municipio: string

  /** Código IBGE do município (7 dígitos) */
  codigoMunicipio: string

  /** CEP (sem formatação) */
  cep: string

  /** Logradouro */
  logradouro: string

  /** Número */
  numero: string

  /** Bairro */
  bairro: string

  /** Complemento (opcional) */
  complemento?: string

  /** Inscrição Estadual (vazio se Simples Nacional) */
  inscricaoEstadual?: string

  /** Código de regime tributário: 1 = Simples Nacional, 3 = Normal */
  crt: '1' | '3'
}

/**
 * Resposta de emissão SAT
 */
export interface ControlIDEmissaoResponse {
  /** Código de retorno: 06000 = sucesso */
  EEEEE: string

  /** Mensagem descritiva */
  mensagem: string

  /** Chave de acesso (44 dígitos) */
  chaveAcesso?: string

  /** Número do cupom fiscal */
  numeroCupom?: string

  /** Série do cupom */
  serie?: string

  /** XML retornado pelo SAT */
  xmlRetorno?: string

  /** Número de sessão utilizado */
  numeroSessao?: string

  /** Timestamp da emissão */
  dataEmissao?: string
}

/**
 * Resposta de cancelamento
 */
export interface ControlIDCancelamentoResponse {
  /** Código de retorno */
  EEEEE: string

  /** Mensagem */
  mensagem: string

  /** XML de retorno do cancelamento */
  xmlRetorno?: string

  /** Status do cancelamento */
  statusCancelamento: 'cancelado' | 'erro' | 'pendente'

  /** Chave do CF-e cancelado */
  chaveAcesso?: string

  /** Número de sessão utilizado */
  numeroSessao?: string
}

/**
 * Configuração de logs
 */
export interface ControlIDLogsConfig {
  /** Diretório de armazenamento */
  diretorio: string

  /** Filtrar por data (YYYY-MM-DD) */
  dataInicio?: string

  /** Até quando filtrar */
  dataFim?: string

  /** Extrair apenas erros */
  apenasErros?: boolean
}

/**
 * Resposta de extração de logs
 */
export interface ControlIDLogsResponse {
  /** Arquivo .zip com logs */
  arquivo?: Buffer

  /** URL para download do arquivo */
  urlDownload?: string

  /** Número de logs extraídos */
  totalLogs: number

  /** Período dos logs */
  periodo: {
    inicio: string
    fim: string
  }
}

/**
 * Diagnóstico do equipamento
 */
export interface ControlIDDiagnostico {
  /** Status geral: ok | warning | error */
  status: 'ok' | 'warning' | 'error'

  /** Versão do firmware */
  firmwareVersion?: string

  /** Memória disponível */
  memoriaLivre?: string

  /** Última sincronização com SEFAZ */
  ultimaSincronizacao?: string

  /** Certificado vigente? */
  certificadoVigente: boolean

  /** Data vencimento certificado */
  dataVencimentoCertificado?: string

  /** CF-e pendentes */
  cfePendentes: number

  /** Conectividade SEFAZ */
  conectividadeSefaz: 'ok' | 'intermitente' | 'erro'

  /** Diagnósticos adicionais */
  diagnosticos: Array<{
    item: string
    status: 'ok' | 'warning' | 'error'
    mensagem: string
  }>
}

export default ControlIDConfig
