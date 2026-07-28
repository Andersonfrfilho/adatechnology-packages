---
'@adatechnology/fiscal-provider': minor
---

CT-e 4.00: autorização real na SEFAZ SP (cStat 100)

Nenhum CT-e 4.00 conseguia ser autorizado. Cada defeito abaixo foi provado contra
`homologacao.nfe.fazenda.sp.gov.br/CTeWS/WS/CTeRecepcaoSincV4.asmx` com certificado A1 real, e
corrigido com teste de contrato escrito antes da implementação.

Transporte (`CteSoapClient.ts`):

- `cteDadosMsg` é `xsd:string` no WSDL — o CT-e vai compactado em GZip e codificado em Base64. Com o
  XML embutido como elemento a SEFAZ devolvia `HTTP 400` com corpo vazio; com Base64 sem GZip, cStat
  244.
- a resposta síncrona chega em `cteRecepcaoResult > retCTe`, não `retCTeSinc` — o parser devolvia
  `cStat` vazio e o resultado virava `SEFAZ_UNKNOWN`.

Schema do XML (`CteXmlBuilder.ts`, `SefazXmlSigner.ts`):

- `infCTe` → `infCte`, com `versao="4.00"` no `infCte` e não no `<CTe>`;
- `enderRem` → `enderReme`;
- `<infModal versao=…>` → `versaoModal="4.00"`;
- `qCarga` com as quatro casas decimais de `TDec_1104`;
- emitente do Simples Nacional (CRT 1/2) usa o grupo `ICMSSN`, não `ICMS90`;
- `serie` e `nCT` sem zeros à esquerda — o padding só vale dentro da chave de acesso;
- `infCTeSupl/qrCodCTe` passa a ser emitido, com a URL do portal de consulta por UF
  (`getCteQrCodeUrl`, novo export), e a assinatura vai para o fim do `CTe`, depois do grupo
  suplementar, como o schema exige.

Homologação: a razão social de remetente, destinatário, expedidor e recebedor é substituída pelo
literal exigido pela SEFAZ (`CTE EMITIDO EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL`), eliminando
as rejeições 646 e 649. Em produção os nomes reais são preservados.

Segurança (`FiscalProviderFactory.ts`): o erro de modelo desconhecido serializava a config inteira,
expondo `certificadoBase64` e `certificadoSenha` em log e stack. Agora só o discriminante `model`
aparece na mensagem.
