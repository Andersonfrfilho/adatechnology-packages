import { useState, useRef, type FormEvent, type ChangeEvent } from 'react';
import { testConnection, emitDocument, cancelDocument, certificateInfo, consultaCnpj, validateXml, importXmlBatch, consultarDistribuicao } from './api/fiscal';
import type { ConnectionResult, EmitResult, CancelResult, CertificateInfo } from './types';
import type { XmlValidationResult, BatchImportResult, DfeItemResult, ConsultarDistribuicaoResult } from './api/fiscal';
import {
  gerarEmitente,
  gerarNfceExtra,
  gerarNfeExtra,
  gerarSatExtra,
  gerarNfseExtra,
  gerarProduto,
  getNfceUf,
  getSatUf,
} from './utils/fakeData';

type Tab = 'connection' | 'emit' | 'cancel' | 'certificate' | 'xml' | 'batch' | 'search';

const TAB_TIPS: Record<Tab, string[]> = {
  connection: [
    'Selecione o modelo fiscal e ambiente (homologação para testes)',
    'Use 🔍 ao lado do CNPJ para buscar dados reais da Receita Federal',
    'SAT não precisa de certificado — apenas URL e código de ativação',
    'NFS-e ABRASF precisa da URL do webservice municipal',
  ],
  emit: [
    'Clique em "Regenerar Dados" para preencher tudo com dados fake realistas',
    'NFC-e: precisa de CSC/CSC ID + certificado A1 + UF compatível (MG, RS, PR...)',
    'NF-e: preencha destinatário + natureza da operação',
    'SAT: aponte para o middleware local (http://localhost:9090) com código de ativação',
    'NFS-e: informe inscrição municipal, código de serviço e alíquota ISS',
  ],
  cancel: [
    'Precisa da chave de acesso (44 dígitos) e protocolo de autorização',
    'Justificativa deve ter no mínimo 15 caracteres',
    'O certificado usado deve ser o mesmo da emissão (mesmo CNPJ)',
  ],
  certificate: [
    'Faça upload do arquivo .pfx na barra superior primeiro',
    'O certificado é compartilhado entre todas as abas',
    'Use o botão 🔍 no CNPJ para buscar dados reais e depois validar o certificado',
  ],
  xml: [
    'Cole o XML ou carregue um arquivo .xml',
    'Suporta: NF-e (nfeProc/NFe), NFC-e, CT-e, CF-e/SAT, NFS-e',
    'Para validar XMLs assinados, o certificado não é necessário',
  ],
  batch: [
    'Selecione múltiplos arquivos .xml de uma vez',
    'Suporta: nfeProc, NFe, procEventoNFe',
    'O resultado mostra status por arquivo com chave, CNPJ e valor',
  ],
  search: [
    'Consulta a SEFAZ Nacional — requer certificado A1 do próprio CNPJ',
    'Deixe "Último NSU" em branco na primeira consulta',
    'Use o ultNSU retornado para buscas incrementais',
    'Ambiente de homologação retorna dados de teste',
  ],
};

type ModelType = 'nfce' | 'nfe' | 'sat' | 'nfse' | 'nfse-notarp' | 'cte';

interface ModelInfo {
  label: string;
  desc: string;
  connectionPreset: Record<string, string>;
  emitPreset: Record<string, string | number | boolean>;
  certRequired: boolean;
  extraFields: string[];
}

const MODEL_INFO: Record<ModelType, ModelInfo> = {
  nfce: {
    label: 'NFC-e (modelo 65)',
    desc: 'Nota Fiscal de Consumidor Eletrônica. Cupom fiscal eletrônico para varejo. Requer CSC.',
    connectionPreset: { uf: 'MG', cnpj: '11222333000181' },
    emitPreset: { serie: '1', numeroNf: 1, crt: '1', csc: '', cscId: '', codigoMunicipio: '3106200' },
    certRequired: true,
    extraFields: ['csc', 'cscId', 'codigoMunicipio'],
  },
  nfe: {
    label: 'NF-e (modelo 55)',
    desc: 'Nota Fiscal Eletrônica. Modelo padrão para operações interestaduais e vendas B2B.',
    connectionPreset: { uf: 'SP', cnpj: '11222333000181' },
    emitPreset: { serie: '1', numeroNf: 1, crt: '1', codigoMunicipio: '3550308' },
    certRequired: true,
    extraFields: ['codigoMunicipio', 'destinatario'],
  },
  sat: {
    label: 'SAT Fiscal (CF-e)',
    desc: 'Sistema Autenticador e Transmissor. Equipamento fiscal em SP/CE. Sem certificado A1.',
    connectionPreset: { uf: 'SP', cnpj: '61156864000191' },
    emitPreset: { serie: '1', crt: '1', satUrl: 'http://localhost:9090', activationCode: '123456', signatureAC: '' },
    certRequired: false,
    extraFields: ['satUrl', 'activationCode', 'signatureAC'],
  },
  nfse: {
    label: 'NFS-e ABRASF',
    desc: 'Nota Fiscal de Serviço Eletrônica. Envio via webservice municipal (padrão ABRASF).',
    connectionPreset: { uf: 'SP', cnpj: '11222333000181' },
    emitPreset: { inscricaoMunicipal: '', codigoServico: '', aliquotaIss: 5, issRetido: false, codigoMunicipio: '3550308' },
    certRequired: true,
    extraFields: ['webserviceUrl', 'inscricaoMunicipal', 'codigoServico', 'aliquotaIss'],
  },
  'nfse-notarp': {
    label: 'NFS-e NotaRP',
    desc: 'NFS-e via API da NotaRP. Autenticação via API token. Sem certificado A1.',
    connectionPreset: { uf: 'SP', cnpj: '11222333000181' },
    emitPreset: { inscricaoMunicipal: '' },
    certRequired: false,
    extraFields: ['apiToken', 'inscricaoMunicipal'],
  },
  cte: {
    label: 'CT-e (modelo 57)',
    desc: 'Conhecimento de Transporte Eletrônico. Documento fiscal de transporte de cargas.',
    connectionPreset: { uf: 'SP', cnpj: '11222333000181' },
    emitPreset: { serie: '1', numeroCte: 1, crt: '1', codigoMunicipio: '3550308', rntrc: '' },
    certRequired: true,
    extraFields: ['rntrc', 'codigoMunicipio'],
  },
};

interface CertState {
  base64: string;
  senha: string;
  fileName: string | null;
}

function App() {
  const [tab, setTab] = useState<Tab>('connection');
  const [cert, setCert] = useState<CertState>({ base64: '', senha: '', fileName: null });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      setCert((prev) => ({ ...prev, base64, fileName: file.name }));
    };
    reader.readAsDataURL(file);
  };

  const handleSenhaChange = (e: ChangeEvent<HTMLInputElement>) => {
    setCert((prev) => ({ ...prev, senha: e.target.value }));
  };

  const handleClearCert = () => {
    setCert({ base64: '', senha: '', fileName: null });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="app">
      <header className="header">
        <h1>Fiscal Provider - Exemplo</h1>
        <p className="subtitle">Demo do <code>@adatechnology/fiscal-provider</code></p>
      </header>

      <nav className="tabs">
        {([
          ['connection', 'Testar Conexão'],
          ['emit', 'Emitir Documento'],
          ['cancel', 'Cancelar Documento'],
          ['certificate', 'Certificado'],
          ['xml', 'Validar XML'],
          ['batch', 'Importar em Lote'],
          ['search', 'Buscar NF-es'],
        ] as [Tab, string][]).map(([key, label]) => (
          <button
            key={key}
            className={`tab ${tab === key ? 'active' : ''}`}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </nav>

      {TAB_TIPS[tab] && (
        <div className="tips-bar">
          <span className="tips-title">Dicas:</span>
          <ul className="tips-list">
            {TAB_TIPS[tab].map((tip, i) => (
              <li key={i}>{tip}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="cert-upload-bar">
        <div className="cert-upload-header">
          <span className="cert-upload-title">Certificado A1</span>
          {cert.fileName && (
            <span className="cert-upload-status" title={`Senha: ${cert.senha ? 'definida' : 'não definida'}`}>
              {cert.fileName} {cert.senha ? '(pronto)' : '(senha pendente)'}
            </span>
          )}
        </div>
        <div className="cert-upload-controls">
          <label className="file-upload-label">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pfx,.p12"
              onChange={handleFileChange}
              className="file-upload-input"
            />
            <span className="file-upload-btn">{cert.fileName ? 'Trocar Arquivo' : 'Selecionar .pfx'}</span>
          </label>
          <input
            type="password"
            value={cert.senha}
            onChange={handleSenhaChange}
            placeholder="Senha do certificado"
            className="cert-password-input"
          />
          {cert.fileName && (
            <button type="button" className="btn-cert-clear" onClick={handleClearCert} title="Remover certificado">
              Limpar
            </button>
          )}
        </div>
      </div>

      <main className="content">
        {tab === 'connection' && <ConnectionTest certBase64={cert.base64} certSenha={cert.senha} />}
        {tab === 'emit' && <DocumentEmit certBase64={cert.base64} certSenha={cert.senha} />}
        {tab === 'cancel' && <DocumentCancel certBase64={cert.base64} certSenha={cert.senha} />}
        {tab === 'certificate' && <CertificateInfo certBase64={cert.base64} certSenha={cert.senha} />}
        {tab === 'xml' && <XmlValidator />}
        {tab === 'batch' && <BatchImport />}
        {tab === 'search' && <NfeSearch certBase64={cert.base64} certSenha={cert.senha} />}
      </main>
    </div>
  );
}

function ResultBox({ result }: { result: unknown }) {
  if (!result) return null;
  return (
    <div className="result-box">
      <h3>Resultado</h3>
      <pre>{JSON.stringify(result, null, 2)}</pre>
    </div>
  );
}

function ErrorBox({ error }: { error: string | null }) {
  if (!error) return null;
  return <div className="error-box">{error}</div>;
}

function ConnectionTest({ certBase64, certSenha }: { certBase64: string; certSenha: string }) {
  const [loading, setLoading] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [result, setResult] = useState<ConnectionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState(() => {
    const emit = gerarEmitente('SP');
    return {
      model: 'nfe' as ModelType,
      environment: 'homologacao',
      uf: emit.uf,
      cnpj: emit.cnpj,
      webserviceUrl: '',
      apiToken: '',
    };
  });

  const gerarDados = (model: ModelType) => {
    const uf = model === 'nfce' ? getNfceUf() : model === 'sat' ? getSatUf() : 'SP';
    const emit = gerarEmitente(uf);
    setForm((prev) => ({
      ...prev,
      model,
      uf: emit.uf,
      cnpj: emit.cnpj,
    }));
    setResult(null);
    setError(null);
  };

  const update = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm((prev) => {
      const next = { ...prev, [name]: value };
      if (name === 'model') gerarDados(value as ModelType);
      return next;
    });
  };

  const handleCnpjLookup = async () => {
    const cnpjClean = form.cnpj.replace(/\D/g, '');
    if (cnpjClean.length !== 14) { setError('CNPJ deve ter 14 dígitos'); return; }
    setLookupLoading(true); setError(null);
    try {
      const data = await consultaCnpj(cnpjClean);
      setForm((prev) => ({ ...prev, uf: data.uf || prev.uf }));
    } catch (err: any) { setError(err.message); }
    finally { setLookupLoading(false); }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true); setResult(null); setError(null);
    try {
      const res = await testConnection({ ...form, certificadoBase64: certBase64 || undefined, certificadoSenha: certSenha || undefined });
      setResult(res);
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  const info = MODEL_INFO[form.model];
  const precisaCert = info.certRequired;

  return (
    <div>
      <h2>Testar Conexão - {info.label}</h2>
      <p className="desc">{info.desc}</p>
      {precisaCert && !certBase64 && (
        <div className="hint-box">Este modelo requer certificado A1. Faça upload do .pfx na barra superior.</div>
      )}

      <form onSubmit={submit} className="form">
        <div className="form-row">
          <label>
            Modelo Fiscal
            <select name="model" value={form.model} onChange={update}>
              {Object.entries(MODEL_INFO).map(([key, m]) => (
                <option key={key} value={key}>{m.label}</option>
              ))}
            </select>
          </label>
          <label>
            Ambiente
            <select name="environment" value={form.environment} onChange={update}>
              <option value="homologacao">Homologação</option>
              <option value="producao">Produção</option>
            </select>
          </label>
          <label>
            UF
            <input name="uf" value={form.uf} onChange={update} placeholder="SP" maxLength={2} />
          </label>
          <label>
            CNPJ
            <div className="input-with-btn">
              <input name="cnpj" value={form.cnpj} onChange={update} placeholder="11222333000181" />
              <button type="button" className="btn-lookup" onClick={handleCnpjLookup} disabled={lookupLoading} title="Buscar dados reais da Receita">
                {lookupLoading ? '...' : '🔍'}
              </button>
            </div>
          </label>
        </div>

        <div className="form-actions">
          <button type="button" className="btn btn-outline" onClick={() => gerarDados(form.model)} title="Gerar novos dados aleatórios">
            Regenerar Dados
          </button>
          <button type="submit" disabled={loading} className="btn btn-primary">
            {loading ? 'Testando...' : 'Testar Conexão'}
          </button>
        </div>
      </form>

      <ResultBox result={result} />
      <ErrorBox error={error} />
    </div>
  );
}

function DocumentEmit({ certBase64, certSenha }: { certBase64: string; certSenha: string }) {
  const [loading, setLoading] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [result, setResult] = useState<EmitResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const genEmit = (model: ModelType) => {
    const uf = model === 'nfce' ? getNfceUf() : model === 'sat' ? getSatUf() : 'SP';
    const emit = gerarEmitente(uf);
    const produto = gerarProduto(1);
    const total = produto.quantidade * produto.valorUnitario;
    return {
      referenceId: `order-${Date.now().toString(36)}`,
      model,
      environment: 'homologacao',
      uf: emit.uf,
      cnpj: emit.cnpj,
      inscricaoEstadual: emit.ie,
      razaoSocial: emit.razaoSocial,
      codigoMunicipio: emit.codigoMunicipio,
      cep: emit.cep,
      logradouro: emit.logradouro,
      numero: emit.numero,
      bairro: emit.bairro,
      municipio: emit.municipio,
      crt: emit.crt,
      serie: '1',
      numeroNf: 1,
      csc: '',
      cscId: '',
      satUrl: 'http://localhost:9090',
      activationCode: '123456',
      signatureAC: '',
      webserviceUrl: '',
      apiToken: '',
      inscricaoMunicipal: '',
      codigoServico: '',
      aliquotaIss: 5,
      issRetido: false,
      totalAmount: total,
      discountAmount: 0,
      destCnpj: '',
      destNome: '',
      destUf: '',
      destMunicipio: '',
      destCodMun: '',
      destCep: '',
      destLogradouro: '',
      destNumero: '',
      destBairro: '',
      destIndicadorIe: '9',
      naturezaOperacao: 'Venda de mercadoria',
      paymentMethod: 'pix',
      itemCodigo: produto.codigo,
      itemDescricao: produto.descricao,
      itemNcm: produto.ncm,
      itemCfop: produto.cfop,
      itemCst: produto.cst,
      itemUnidade: produto.unidade,
      itemQuantidade: produto.quantidade,
      itemValorUnitario: produto.valorUnitario,
    };
  };

  const [form, setForm] = useState(() => genEmit('nfe'));

  const gerarDados = (model: ModelType) => {
    const novoForm = genEmit(model);
    if (model === 'nfce') {
      const nfcExtra = gerarNfceExtra();
      novoForm.csc = nfcExtra.csc;
      novoForm.cscId = nfcExtra.cscId;
    }
    if (model === 'nfe') {
      const nfeExtra = gerarNfeExtra();
      Object.assign(novoForm, {
        destCnpj: nfeExtra.destCnpj, destNome: nfeExtra.destNome, destUf: nfeExtra.destUf,
        destCep: nfeExtra.destCep, destLogradouro: nfeExtra.destLogradouro, destNumero: nfeExtra.destNumero,
        destBairro: nfeExtra.destBairro, destMunicipio: nfeExtra.destMunicipio, destCodMun: nfeExtra.destCodMun,
        destIndicadorIe: nfeExtra.destIndicadorIe, naturezaOperacao: nfeExtra.naturezaOperacao,
      });
    }
    if (model === 'sat') {
      const satExtra = gerarSatExtra();
      novoForm.satUrl = satExtra.satUrl;
      novoForm.activationCode = satExtra.activationCode;
      novoForm.signatureAC = satExtra.signatureAC;
    }
    if (model === 'nfse') {
      const nfseExtra = gerarNfseExtra();
      novoForm.webserviceUrl = nfseExtra.webserviceUrl;
      novoForm.inscricaoMunicipal = nfseExtra.inscricaoMunicipal;
      novoForm.codigoServico = nfseExtra.codigoServico;
      novoForm.aliquotaIss = nfseExtra.aliquotaIss;
    }
    setForm(novoForm);
    setResult(null);
    setError(null);
  };

  const update = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const val = e.target.type === 'number' ? Number(e.target.value) : e.target.value;
    const next = { ...form, [e.target.name]: val };
    if (e.target.name === 'model') gerarDados(val as ModelType);
    else setForm(next);
  };

  const handleCnpjLookup = async () => {
    const cnpjClean = form.cnpj.replace(/\D/g, '');
    if (cnpjClean.length !== 14) { setError('CNPJ deve ter 14 dígitos'); return; }
    setLookupLoading(true); setError(null);
    try {
      const data = await consultaCnpj(cnpjClean);
      setForm((prev) => ({
        ...prev,
        razaoSocial: data.razaoSocial || prev.razaoSocial,
        uf: data.uf || prev.uf,
        cep: data.cep || prev.cep,
        logradouro: data.logradouro || prev.logradouro,
        numero: data.numero || prev.numero,
        bairro: data.bairro || prev.bairro,
        municipio: data.municipio || prev.municipio,
        codigoMunicipio: data.codigoMunicipio || prev.codigoMunicipio,
      }));
    } catch (err: any) { setError(err.message); }
    finally { setLookupLoading(false); }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true); setResult(null); setError(null);
    try {
      const item = {
        codigo: form.itemCodigo, descricao: form.itemDescricao,
        ncm: form.itemNcm || undefined, cfop: form.itemCfop || undefined,
        cst: form.itemCst || undefined, unidade: form.itemUnidade,
        quantidade: Number(form.itemQuantidade), valorUnitario: Number(form.itemValorUnitario),
        valorTotal: Number(form.itemQuantidade) * Number(form.itemValorUnitario),
      };
      const payment = { method: form.paymentMethod, amount: Number(form.totalAmount) };
      const config: Record<string, unknown> = {
        model: form.model, environment: form.environment, uf: form.uf, cnpj: form.cnpj,
        inscricaoEstadual: form.inscricaoEstadual, razaoSocial: form.razaoSocial,
        codigoMunicipio: form.codigoMunicipio, cep: form.cep, logradouro: form.logradouro,
        numero: form.numero, bairro: form.bairro, municipio: form.municipio,
        crt: form.crt, serie: form.serie, numeroNf: Number(form.numeroNf),
        certificadoBase64: certBase64 || undefined, certificadoSenha: certSenha || undefined,
      };
      if (form.model === 'nfce') { config.csc = form.csc; config.cscId = form.cscId; }
      if (form.model === 'sat') { Object.assign(config, { satUrl: form.satUrl, activationCode: form.activationCode, signatureAC: form.signatureAC }); }
      if (form.model === 'nfse') { Object.assign(config, { webserviceUrl: form.webserviceUrl, inscricaoMunicipal: form.inscricaoMunicipal, codigoServico: form.codigoServico, aliquotaIss: Number(form.aliquotaIss), issRetido: Boolean(form.issRetido) }); }
      if (form.model === 'nfse-notarp') { Object.assign(config, { apiToken: form.apiToken, inscricaoMunicipal: form.inscricaoMunicipal }); }

      const payload: Record<string, unknown> = { referenceId: form.referenceId, config, totalAmount: Number(form.totalAmount), discountAmount: Number(form.discountAmount), items: [item], payments: [payment] };
      if (form.model === 'nfe') {
        payload.nfeData = { destinatario: { cnpj: form.destCnpj, xNome: form.destNome, uf: form.destUf, municipio: form.destMunicipio, codigoMunicipio: form.destCodMun, cep: form.destCep, logradouro: form.destLogradouro, numero: form.destNumero, bairro: form.destBairro, indicadorIe: form.destIndicadorIe }, naturezaOperacao: form.naturezaOperacao };
      }
      const res = await emitDocument(payload as any);
      setResult(res);
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  const info = MODEL_INFO[form.model as ModelType];
  const showNfce = form.model === 'nfce';
  const showNfe = form.model === 'nfe';
  const showSat = form.model === 'sat';
  const showNfse = form.model === 'nfse';
  const showNfseNotarp = form.model === 'nfse-notarp';

  return (
    <div>
      <h2>Emitir Documento - {info.label}</h2>
      <p className="desc">{info.desc}</p>
      {info.certRequired && !certBase64 && (
        <div className="hint-box">Este modelo requer certificado A1. Faça upload do .pfx na barra superior.</div>
      )}

      <form onSubmit={submit} className="form">
        <fieldset>
          <legend>Configuração do Emissor</legend>
          <div className="form-grid">
            <label>
              Modelo
              <select name="model" value={form.model} onChange={update}>
                {Object.entries(MODEL_INFO).map(([key, m]) => (
                  <option key={key} value={key}>{m.label}</option>
                ))}
              </select>
            </label>
            <label>
              Ambiente
              <select name="environment" value={form.environment} onChange={update}>
                <option value="homologacao">Homologação</option>
                <option value="producao">Produção</option>
              </select>
            </label>
            <label>UF <input name="uf" value={form.uf} onChange={update} maxLength={2} /></label>
            <label>
              CNPJ
              <div className="input-with-btn">
                <input name="cnpj" value={form.cnpj} onChange={update} />
                <button type="button" className="btn-lookup" onClick={handleCnpjLookup} disabled={lookupLoading} title="Buscar dados reais da Receita">{lookupLoading ? '...' : '🔍'}</button>
              </div>
            </label>
            <label>IE <input name="inscricaoEstadual" value={form.inscricaoEstadual} onChange={update} /></label>
            <label>Razão Social <input name="razaoSocial" value={form.razaoSocial} onChange={update} /></label>
            <label>Cod. Município <input name="codigoMunicipio" value={form.codigoMunicipio} onChange={update} /></label>
            <label>Município <input name="municipio" value={form.municipio} onChange={update} /></label>
            <label>CEP <input name="cep" value={form.cep} onChange={update} /></label>
            <label>Logradouro <input name="logradouro" value={form.logradouro} onChange={update} /></label>
            <label>Número <input name="numero" value={form.numero} onChange={update} /></label>
            <label>Bairro <input name="bairro" value={form.bairro} onChange={update} /></label>
            <label>Série <input name="serie" value={form.serie} onChange={update} /></label>
            <label>Número NF <input name="numeroNf" type="number" value={form.numeroNf} onChange={update} /></label>
            <label>CRT <input name="crt" value={form.crt} onChange={update} /></label>
            {showNfce && <><label>CSC <input name="csc" value={form.csc} onChange={update} /></label><label>CSC ID <input name="cscId" value={form.cscId} onChange={update} /></label></>}
            {showSat && <><label className="wide">URL SAT <input name="satUrl" value={form.satUrl} onChange={update} /></label><label>Cód. Ativação <input name="activationCode" value={form.activationCode} onChange={update} /></label><label>Signature AC <input name="signatureAC" value={form.signatureAC} onChange={update} /></label></>}
            {showNfse && <><label className="wide">URL Webservice <input name="webserviceUrl" value={form.webserviceUrl} onChange={update} /></label><label>Insc. Municipal <input name="inscricaoMunicipal" value={form.inscricaoMunicipal} onChange={update} /></label><label>Cod. Serviço <input name="codigoServico" value={form.codigoServico} onChange={update} /></label><label>Aliq. ISS <input name="aliquotaIss" type="number" step="0.5" value={form.aliquotaIss} onChange={update} /></label></>}
            {showNfseNotarp && <><label className="wide">API Token <input name="apiToken" value={form.apiToken} onChange={update} /></label><label>Insc. Municipal <input name="inscricaoMunicipal" value={form.inscricaoMunicipal} onChange={update} /></label></>}
          </div>
        </fieldset>

        <fieldset>
          <legend>Item / Produto</legend>
          <div className="form-grid">
            <label>Código <input name="itemCodigo" value={form.itemCodigo} onChange={update} /></label>
            <label className="wide">Descrição <input name="itemDescricao" value={form.itemDescricao} onChange={update} /></label>
            <label>NCM <input name="itemNcm" value={form.itemNcm} onChange={update} /></label>
            <label>CFOP <input name="itemCfop" value={form.itemCfop} onChange={update} /></label>
            <label>CST <input name="itemCst" value={form.itemCst} onChange={update} /></label>
            <label>Unidade <input name="itemUnidade" value={form.itemUnidade} onChange={update} /></label>
            <label>Qtd <input name="itemQuantidade" type="number" value={form.itemQuantidade} onChange={update} /></label>
            <label>Valor Unit <input name="itemValorUnitario" type="number" step="0.01" value={form.itemValorUnitario} onChange={update} /></label>
          </div>
        </fieldset>

        <fieldset>
          <legend>Pagamento</legend>
          <div className="form-grid">
            <label>Total <input name="totalAmount" type="number" step="0.01" value={form.totalAmount} onChange={update} /></label>
            <label>Desconto <input name="discountAmount" type="number" step="0.01" value={form.discountAmount} onChange={update} /></label>
            <label>
              Método
              <select name="paymentMethod" value={form.paymentMethod} onChange={update}>
                <option value="pix">PIX</option>
                <option value="credit">Crédito</option>
                <option value="debit">Débito</option>
                <option value="money">Dinheiro</option>
              </select>
            </label>
          </div>
        </fieldset>

        {showNfe && (
          <fieldset>
            <legend>Destinatário (NF-e)</legend>
            <div className="form-grid">
              <label>CNPJ Dest <input name="destCnpj" value={form.destCnpj} onChange={update} /></label>
              <label className="wide">Nome Dest <input name="destNome" value={form.destNome} onChange={update} /></label>
              <label>UF <input name="destUf" value={form.destUf} onChange={update} maxLength={2} /></label>
              <label>Município <input name="destMunicipio" value={form.destMunicipio} onChange={update} /></label>
              <label>Cod Mun <input name="destCodMun" value={form.destCodMun} onChange={update} /></label>
              <label>CEP <input name="destCep" value={form.destCep} onChange={update} /></label>
              <label>Logradouro <input name="destLogradouro" value={form.destLogradouro} onChange={update} /></label>
              <label>Número <input name="destNumero" value={form.destNumero} onChange={update} /></label>
              <label>Bairro <input name="destBairro" value={form.destBairro} onChange={update} /></label>
              <label>Indicador IE <input name="destIndicadorIe" value={form.destIndicadorIe} onChange={update} /></label>
              <label className="wide">Natureza Op <input name="naturezaOperacao" value={form.naturezaOperacao} onChange={update} /></label>
            </div>
          </fieldset>
        )}

        <div className="form-actions">
          <button type="button" className="btn btn-outline" onClick={() => gerarDados(form.model as ModelType)} title="Gerar novos dados aleatórios para todos os campos">
            Regenerar Dados
          </button>
          <button type="submit" disabled={loading} className="btn btn-primary">
            {loading ? 'Emitindo...' : 'Emitir Documento'}
          </button>
        </div>
      </form>

      <ResultBox result={result} />
      <ErrorBox error={error} />
    </div>
  );
}

function DocumentCancel({ certBase64, certSenha }: { certBase64: string; certSenha: string }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CancelResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    model: 'nfe',
    environment: 'homologacao',
    uf: 'SP',
    cnpj: '11222333000181',
    csc: '',
    cscId: '',
    serie: '1',
    chaveAcesso: '',
    protocolo: '',
    justificativa: 'Cancelamento solicitado por erro no pedido',
  });

  const update = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const res = await cancelDocument({
        ...form,
        certificadoBase64: certBase64 || undefined,
        certificadoSenha: certSenha || undefined,
      });
      setResult(res);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2>Cancelar Documento Fiscal</h2>
      <p className="desc">Cancela um documento previamente autorizado usando a chave de acesso e protocolo.</p>

      <form onSubmit={submit} className="form">
        <div className="form-grid">
          <label>
            Modelo
            <select name="model" value={form.model} onChange={update}>
              <option value="nfce">NFC-e</option>
              <option value="nfe">NF-e</option>
            </select>
          </label>
          <label>
            Ambiente
            <select name="environment" value={form.environment} onChange={update}>
              <option value="homologacao">Homologação</option>
              <option value="producao">Produção</option>
            </select>
          </label>
          <label>UF <input name="uf" value={form.uf} onChange={update} maxLength={2} /></label>
          <label>CNPJ <input name="cnpj" value={form.cnpj} onChange={update} /></label>
          <label>Série <input name="serie" value={form.serie} onChange={update} /></label>
        </div>

        <div className="form-row" style={{ marginTop: '1rem' }}>
          <label className="wide">
            Chave de Acesso (44 dígitos)
            <input name="chaveAcesso" value={form.chaveAcesso} onChange={update} placeholder="352506..." maxLength={44} />
          </label>
          <label className="wide">
            Protocolo de Autorização
            <input name="protocolo" value={form.protocolo} onChange={update} placeholder="1352500..." />
          </label>
          <label className="wide">
            Justificativa (mín 15 caracteres)
            <textarea name="justificativa" value={form.justificativa} onChange={update} rows={2} />
          </label>
        </div>

        <button type="submit" disabled={loading} className="btn btn-danger">
          {loading ? 'Cancelando...' : 'Cancelar Documento'}
        </button>
      </form>

      <ResultBox result={result} />
      <ErrorBox error={error} />
    </div>
  );
}

function CertificateInfo({ certBase64, certSenha }: { certBase64: string; certSenha: string }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CertificateInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [senha, setSenha] = useState(certSenha);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const base64ToUse = certBase64;
    if (!base64ToUse) {
      setError('Faça o upload do certificado .pfx primeiro na barra superior.');
      return;
    }
    if (!senha) {
      setError('Informe a senha do certificado.');
      return;
    }
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const res = await certificateInfo(base64ToUse, senha);
      setResult(res);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2>Validar Certificado A1</h2>
      <p className="desc">Inspeciona o certificado digital A1 (.pfx) para extrair informações como CNPJ, validade e entidade emissora.</p>

      <form onSubmit={submit} className="form">
        <label>
          Senha do Certificado
          <input
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            placeholder="Senha do arquivo .pfx"
            style={{ maxWidth: 300 }}
          />
        </label>

        <button type="submit" disabled={loading || !certBase64} className="btn btn-primary">
          {loading ? 'Validando...' : 'Validar Certificado'}
        </button>
      </form>

      {result && (
        <div className="result-box">
          <h3>Informações do Certificado</h3>
          <table className="cert-table">
            <tbody>
              <tr><td>Válido</td><td className={result.valid ? 'success' : 'error'}>{result.valid ? 'Sim' : 'Não'}</td></tr>
              <tr><td>CNPJ</td><td>{result.cnpj || '-'}</td></tr>
              <tr><td>CPF</td><td>{result.cpf || '-'}</td></tr>
              <tr><td>Subject</td><td>{result.subject}</td></tr>
              <tr><td>Emissor</td><td>{result.issuer}</td></tr>
              <tr><td>Válido de</td><td>{String(result.validFrom)}</td></tr>
              <tr><td>Expira em</td><td>{String(result.expiresAt)}</td></tr>
              <tr><td>Possui chave privada</td><td>{result.hasPrivateKey ? 'Sim' : 'Não'}</td></tr>
              <tr><td>Expirado</td><td className={result.isExpired ? 'error' : 'success'}>{result.isExpired ? 'Sim' : 'Não'}</td></tr>
              <tr><td>ICP-Brasil</td><td>{result.isIcpBrasil ? 'Sim' : 'Não'}</td></tr>
              <tr><td>Pode assinar</td><td>{result.canSign ? 'Sim' : 'Não'}</td></tr>
              {result.errors.length > 0 && <tr><td>Erros</td><td className="error">{result.errors.join(', ')}</td></tr>}
              {result.warnings.length > 0 && <tr><td>Avisos</td><td>{result.warnings.join(', ')}</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      <ErrorBox error={error} />
    </div>
  );
}

function XmlValidator() {
  const [loading, setLoading] = useState(false);
  const [xml, setXml] = useState('');
  const [result, setResult] = useState<XmlValidationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setXml(text);
    setResult(null);
    setError(null);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!xml.trim()) { setError('Cole um XML ou selecione um arquivo'); return; }
    setLoading(true); setResult(null); setError(null);
    try {
      const res = await validateXml(xml);
      setResult(res);
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  return (
    <div>
      <h2>Validar XML Fiscal</h2>
      <p className="desc">Cole um XML de NF-e, NFC-e, CT-e, CF-e/SAT ou NFS-e para validar a estrutura e extrair informações.</p>

      <form onSubmit={submit} className="form">
        <label className="wide">
          XML
          <textarea
            value={xml}
            onChange={(e) => setXml(e.target.value)}
            rows={12}
            placeholder="Cole o XML aqui..."
            style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}
          />
        </label>

        <div className="form-actions">
          <label className="file-upload-label">
            <input type="file" accept=".xml" onChange={handleFile} className="file-upload-input" />
            <span className="file-upload-btn">Carregar arquivo .xml</span>
          </label>
          <button type="submit" disabled={loading} className="btn btn-primary">
            {loading ? 'Validando...' : 'Validar XML'}
          </button>
        </div>
      </form>

      <ErrorBox error={error} />

      {result && (
        <div className="result-box">
          <h3>Resultado da Validação</h3>
          <table className="cert-table">
            <tbody>
              <tr><td>XML Bem Formado</td><td className={result.wellFormed ? 'success' : 'error'}>{result.wellFormed ? 'Sim' : 'Não'}</td></tr>
              <tr><td>Tipo de Documento</td><td>{result.documentType}</td></tr>
              {result.chaveAcesso && <tr><td>Chave de Acesso</td><td style={{fontSize:'0.8rem', wordBreak:'break-all'}}>{result.chaveAcesso}</td></tr>}
              {result.cnpjEmitente && <tr><td>CNPJ Emitente</td><td>{result.cnpjEmitente}</td></tr>}
              {result.nomeEmitente && <tr><td>Nome Emitente</td><td>{result.nomeEmitente}</td></tr>}
              {result.valorTotal !== undefined && <tr><td>Valor Total</td><td>R$ {result.valorTotal.toFixed(2)}</td></tr>}
              {result.dataEmissao && <tr><td>Data Emissão</td><td>{result.dataEmissao}</td></tr>}
              {result.schema && <tr><td>Schema</td><td>{result.schema}</td></tr>}
              {result.tipoEvento && <tr><td>Tipo Evento</td><td>{result.tipoEvento} - {result.descricaoEvento}</td></tr>}
              {result.errors.length > 0 && <tr><td>Erros</td><td className="error">{result.errors.join(', ')}</td></tr>}
              {result.warnings.length > 0 && <tr><td>Avisos</td><td>{result.warnings.join(', ')}</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function BatchImport() {
  const [loading, setLoading] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [result, setResult] = useState<BatchImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (e: ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    setFiles(selected);
    setResult(null);
    setError(null);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (files.length === 0) { setError('Selecione ao menos um arquivo .xml'); return; }
    setLoading(true); setResult(null); setError(null);
    try {
      const res = await importXmlBatch(files);
      setResult(res);
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  return (
    <div>
      <h2>Importar XMLs em Lote</h2>
      <p className="desc">Selecione múltiplos arquivos .xml de NF-e/NFC-e para processar em lote. Formatos suportados: nfeProc, NFe, procEventoNFe.</p>

      <form onSubmit={submit} className="form">
        <label className="wide">
          Arquivos XML
          <div className="file-drop-zone">
            <input ref={fileInputRef} type="file" accept=".xml" multiple onChange={handleFiles} className="file-upload-input" />
            <div className="file-drop-content" onClick={() => fileInputRef.current?.click()}>
              <span className="file-drop-icon">📁</span>
              <span>{files.length > 0 ? `${files.length} arquivo(s) selecionado(s)` : 'Clique ou arraste arquivos .xml aqui'}</span>
              {files.length > 0 && <span className="file-drop-names">{files.map(f => f.name).join(', ')}</span>}
            </div>
          </div>
        </label>

        <button type="submit" disabled={loading || files.length === 0} className="btn btn-primary">
          {loading ? 'Importando...' : `Importar ${files.length > 0 ? files.length : ''} XML(s)`}
        </button>
      </form>

      <ErrorBox error={error} />

      {result && (
        <div className="result-box">
          <h3>Resultado: {result.sucesso} de {result.total} importados com sucesso</h3>
          {result.falha > 0 && <p className="error" style={{marginBottom: '0.5rem'}}>{result.falha} falha(s)</p>}
          <div style={{maxHeight: 400, overflow: 'auto'}}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Arquivo</th><th>Status</th><th>Chave NFe</th><th>CNPJ</th><th>Valor</th><th>Erro</th>
                </tr>
              </thead>
              <tbody>
                {result.resultados.map((r, i) => (
                  <tr key={i} className={r.success ? '' : 'row-error'}>
                    <td style={{maxWidth:180, overflow:'hidden', textOverflow:'ellipsis'}}>{r.fileName}</td>
                    <td className={r.success ? 'success' : 'error'}>{r.success ? 'OK' : 'Falha'}</td>
                    <td style={{fontSize:'0.75rem'}}>{r.chaveNfe || '-'}</td>
                    <td>{r.cnpjEmitente || '-'}</td>
                    <td>{r.valorTotal !== undefined ? `R$ ${r.valorTotal.toFixed(2)}` : '-'}</td>
                    <td className="error" style={{fontSize:'0.8rem'}}>{r.error || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function NfeSearch({ certBase64, certSenha }: { certBase64: string; certSenha: string }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ConsultarDistribuicaoResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    cnpj: '',
    uf: 'SP',
    environment: 'homologacao',
    ultNsu: '',
  });

  const update = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.cnpj.replace(/\D/g, '')) { setError('Informe o CNPJ'); return; }
    if (!certBase64) { setError('Faça upload do certificado A1 primeiro'); return; }
    setLoading(true); setResult(null); setError(null);
    try {
      const res = await consultarDistribuicao({
        cnpj: form.cnpj.replace(/\D/g, ''),
        uf: form.uf,
        environment: form.environment,
        certificadoBase64: certBase64,
        certificadoSenha: certSenha,
        ultNsu: form.ultNsu || undefined,
      });
      setResult(res);
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  return (
    <div>
      <h2>Buscar NF-es por CNPJ (Distribuição SEFAZ)</h2>
      <p className="desc">Consulta a SEFAZ Nacional para listar documentos fiscais vinculados ao CNPJ. Requer certificado A1 do próprio CNPJ.</p>

      <form onSubmit={submit} className="form">
        <div className="form-row">
          <label>
            CNPJ
            <input name="cnpj" value={form.cnpj} onChange={update} placeholder="11222333000181" />
          </label>
          <label>
            UF
            <input name="uf" value={form.uf} onChange={update} maxLength={2} />
          </label>
          <label>
            Ambiente
            <select name="environment" value={form.environment} onChange={update}>
              <option value="homologacao">Homologação</option>
              <option value="producao">Produção</option>
            </select>
          </label>
          <label>
            Último NSU (opcional)
            <input name="ultNsu" value={form.ultNsu} onChange={update} placeholder="000000000000000" maxLength={15} />
          </label>
        </div>

        <button type="submit" disabled={loading} className="btn btn-primary">
          {loading ? 'Consultando SEFAZ...' : 'Buscar Documentos'}
        </button>
      </form>

      <ErrorBox error={error} />

      {result && (
        <div className="result-box">
          <h3>{result.total} documento(s) encontrados</h3>
          <p style={{fontSize:'0.8rem', color:'var(--text-muted)'}}>ultNSU: {result.ultNSU} | maxNSU: {result.maxNSU}</p>
          <div style={{maxHeight: 500, overflow: 'auto', marginTop: '0.5rem'}}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Chave NFe</th><th>Schema</th><th>CNPJ Emitente</th><th>Nome</th><th>Valor</th><th>Data</th><th>Sit</th>
                </tr>
              </thead>
              <tbody>
                {result.items.map((item, i) => (
                  <tr key={i}>
                    <td style={{fontSize:'0.7rem', maxWidth:180, overflow:'hidden', textOverflow:'ellipsis'}}>{item.chaveNfe || item.nsu}</td>
                    <td style={{fontSize:'0.75rem'}}>{item.schema || '-'}</td>
                    <td>{item.emitenteCnpj || '-'}</td>
                    <td style={{maxWidth:120, overflow:'hidden', textOverflow:'ellipsis'}}>{item.emitenteNome || '-'}</td>
                    <td>{item.valorTotal !== undefined ? `R$ ${item.valorTotal.toFixed(2)}` : '-'}</td>
                    <td style={{fontSize:'0.8rem'}}>{item.dataEmissao ? item.dataEmissao.slice(0, 10) : '-'}</td>
                    <td className={item.situacao === '1' ? 'success' : item.situacao === '2' ? 'error' : ''}>
                      {item.situacao === '1' ? 'Ativa' : item.situacao === '2' ? 'Canc' : item.situacao || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
