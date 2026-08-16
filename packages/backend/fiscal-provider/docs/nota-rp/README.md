# Integração Nota RP (NFS-e) — v2

Documentação da API da Nota RP, do lado do pacote fiscal. O material original do fornecedor está
versionado em `vendor-v2/` (leia-me, changelog e coleção Postman), porque ele não está publicado na
web: chega por download no painel, e a cada versão nova o link anterior morre. Sem cópia aqui, a
regra de integração vira memória de quem estava na sala.

Este arquivo é o resumo operacional; **em divergência, o material do fornecedor manda**.

> ⚠️ **Esta documentação é da v2. O `NotaRpNfseProvider` deste pacote fala v3**
> (`/api/v3/nota/emitir`, `/api/v3/nota/cancelar`), com formato de payload diferente — `tomador` é
> um objeto aninhado, enquanto a v2 documentada aqui usa campos planos (`RazaoSocial`, `CpfCnpj`,
> `ValorServicos`…). Não há changelog da v3 em mãos. Antes de mexer no provider, **confirme contra a
> coleção da versão que ele usa** — aplicar o que está escrito aqui na v3 é troca de contrato às
> cegas.
>
> **E a v2 não é legado a ser aposentado: ela é a única porta para parte dos municípios.** A própria
> coleção oficial da Nota RP diz que a v3 _"aplica-se … utilize a nossa versão 2"_ para município
> ainda não migrado, e o `NotaRpNfseProvider` devolve erro explícito nesse caso. É por isso que
> existe consumidor deste pacote falando v2 por conta própria — não foi desconhecimento do provider.
> Quem for unificar os dois precisa cobrir a v2 primeiro, senão a unificação derruba esses
> municípios.

## Um endereço só

`https://www.notarp.com.br` — a coleção declara `baseUrl = https://www.notarp.com.br/api/v2`, o
swagger da v3 declara um único `servers[]` com `https://www.notarp.com.br`, e os dois dizem
"produção". **Não existe homologação.** Quem separa uma instalação da outra é a credencial da conta,
não a URL — por isso `NotaRpConfig.baseUrl` é opcional, com o servidor único como padrão.

Consequência para quem consome o pacote: não há ambiente onde exercitar emissão sem mexer em nota
real. Teste de integração contra a Nota RP emite nota de verdade, e cancelar depois é pedido à
prefeitura. (No TransportAdA isso virou o ADR-0035, que trocou o par de URLs por ambiente fiscal por
uma variável só.)

## Autenticação — dois cabeçalhos, não `Authorization`

```
X-AUTH-USER-TOKEN: <token da conta>
X-AUTH-IM:         <inscrição municipal da empresa>
```

O token identifica **a conta**; a inscrição municipal identifica **a empresa** dentro dela. Uma conta
associa várias empresas, então o token sozinho não diz em nome de quem se emite — os dois são
obrigatórios, e o erro de qualquer um deles reprova a requisição.

O token é gerado e revogado em `https://www.notarp.com.br/painel/integracao`.

O `buildHeaders` do `NotaRpNfseProvider` já manda os dois, mais um terceiro — `X-Auth-CNPJ` — que
**não aparece na documentação da v2**. Ou é exigência da v3, ou é campo ignorado pelo servidor; sem o
material da v3 não dá para dizer qual, e a diferença importa: se for ignorado, é ruído; se for
exigido, quem copiar esta página para um cliente v2 vai omiti-lo sem saber.

> ⚠️ Consumidor que escreve o próprio cliente HTTP em vez de usar este provider erra aqui com
> facilidade: `Authorization: Bearer <token>` é o palpite natural, e a Nota RP **ignora** esse
> cabeçalho em silêncio. Foi o que aconteceu no TransportAdA. Ver "Como isso passou despercebido".

## Status HTTP não é o resultado

- Sucesso: `success: true`, HTTP 200.
- **Erro de negócio: `success: false` + `message`, também HTTP 200.**
- Só um status diferente de 200 é falha de comunicação entre servidores.

Quem decide é o corpo. Cliente que ramifica por `response.ok` trata rejeição de prefeitura como
sucesso — e o `success: false` traz a mensagem que explica o motivo.

## Emissão é assíncrona, e o `CallbackUrl` é obrigatório

`POST /emitir` devolve `id_nota` na hora, e o resultado chega depois por postback. O campo
`CallbackUrl` é **obrigatório** e precisa ser `https`.

A URL recebe no máximo duas mensagens por nota, de dois tipos: `protocolo-nota` e `situacao-lote`.
Quando vem `Situação = 4`, os dados da nota emitida já viajam em `ListaNfse->CompNfse[0]` — não é
preciso consultar de novo.

Política de reenvio quando a ponta que recebe não responde 200:

| Janela | Tentativas |
|---|---|
| a cada 30 segundos | 20 |
| a cada 5 minutos | 22 |
| a cada hora | 10 |

Esgotado o limite, a saída é consultar `GET /notas/?id_nota=xxx`. **URL de retorno inválida ou
indisponível sujeita a integração a suspensão por mau uso** — não apontar para `webhook.site` a
partir de conta de produção.

> ⚠️ Quem consome precisa publicar uma rota `https` **antes** de conseguir emitir a primeira nota.
> Não é integração que se liga por metade: sem URL de retorno não há emissão, e o resultado nunca
> chega de forma síncrona.

O postback pode ser assinado: preenchendo o campo de segredo no painel, todo POST vai com
`X-Signature`, o HMAC-SHA256 do corpo. O segredo tem de 16 a 64 caracteres, é independente do token
(regenerar o token não o altera) e vale imediatamente ao ser trocado. Em branco, os postbacks vão
sem assinatura — aí a autenticação da rota tem de vir de outro lugar, como um token opaco no próprio
caminho da URL de retorno.

## Rotas

| Método | Rota | Uso |
|---|---|---|
| POST | `/emitir` | emitir, corrigir nota falhada (com `id_nota`) e substituir (com `SubstituirNfse`) |
| POST | `/cancelar-nota` | cancelar; `motivo` obrigatório |
| GET | `/notas/?id_nota=` | consultar uma nota |
| GET | `/notas/?q=` | buscar por nome |
| GET | `/notas/{emitidas\|canceladas\|pendentes}/:mes/:ano` | listagens paginadas (`start`, `length`) |
| GET | `/xml/:id_nota` | XML da nota, em base64 |
| GET | `/pdf/:id_nota` | PDF no layout da Nota RP, em base64 |
| GET | `/dados-cadastrais` | dados da empresa; traz `operacoes_permitidas` |
| GET | `/atualizar-dados-cadastrais` | força releitura junto à prefeitura |
| GET | `/cnaes/?q=&page=` | catálogo |
| GET | `/item-servico/?cnae=&page=` | catálogo; descrição já formatada `00.00` |
| GET | `/tributacao-municipio/?q=&page=` | catálogo |
| GET | `/cidades-ibge/?q=&page=` · `/paises-ibge/?q=&page=` | catálogos |

`motivo` do cancelamento aceita **1** (erro na emissão — a resposta manda usar substituição), **2**
(serviço não prestado) e **4** (nota duplicada).

`GET /notas/` **responde 200 com lista vazia mesmo sem autenticação**. Não serve para verificar
token; use `/dados-cadastrais`, que devolve 401 `{"success":false,"message":"Token inválido."}`.

## Campos de emissão que mudaram na v2

- `NaturezaOperacao` foi desativado.
- `MunicipioPrestacaoServico` virou `CodigoMunicipio`.
- Novos: `ExigibilidadeISS` (valores válidos vêm de `operacoes_permitidas`, em `/dados-cadastrais`),
  `MunicipioIncidencia`, `NumeroProcesso` (só quando exigibilidade é 6 ou 7), `CodigoNbs`,
  `SubstituirNfse`, e o bloco de exterior (`NIF`, `Pais`, `EnderecoCompletoExterior`).
- Substituição é **síncrona**, ao contrário da emissão: devolve `id_nota` e `id_nota_substituida` na
  própria resposta.

## Como isso passou despercebido

O `GET /notas/` responde 200 com envelope vazio para token válido, token inventado e requisição sem
cabeçalho nenhum:

```
real        http=200  {"draw":0,"data":[],"recordsFiltered":0,"recordsTotal":0}
inválido    http=200  {"draw":0,"data":[],"recordsFiltered":0,"recordsTotal":0}
sem header  http=200
```

Uma verificação feita por essa rota confirma qualquer coisa que se queira confirmar. Foi assim que um
cabeçalho de autenticação errado sobreviveu meses num consumidor: a conta não tinha nota, a consulta
respondia 200, e nada apontava para a autenticação.

O contraste com `/dados-cadastrais`, que é a rota certa para o teste:

```
real        http=200  {"success":true,...}
inválido    http=401  {"success":false,"message":"Token inválido."}
```

A lição vale para além daqui: **teste de integração com terceiro só vale com o controle negativo
junto** — a mesma chamada com credencial inválida precisa falhar de forma visivelmente diferente.
