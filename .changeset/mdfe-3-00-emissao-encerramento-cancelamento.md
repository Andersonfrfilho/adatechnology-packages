---
'@adatechnology/fiscal-provider': minor
---

MDF-e 3.00: emissão, encerramento e cancelamento direto na SVRS

Novo modelo `'mdfe'` no `createFiscalProvider`, atendido por `SefazMdfeProvider`. O Manifesto
Eletrônico de Documentos Fiscais (modelo 58) é o documento que amarra os CT-es de uma viagem ao
veículo e ao condutor — sem ele a carga não circula.

**A SVRS é o autorizador nacional único do MDF-e.** Não existe servidor por UF como no CT-e e na
NF-e: todo emitente, de qualquer estado, transmite para o mesmo endpoint. `MdfeConstants` fixa isso
em vez de derivar o host da UF do emitente.

Três serviços implementados, cada um com o seu envelope próprio:

- `MDFeRecepcaoSinc` — autorização síncrona. O WSDL declara `mdfeDadosMsg` como `xsd:string` e
  recebe o `<MDFe>` nu **compactado em GZip e codificado em Base64**, sem o wrapper `enviMDFe` do
  fluxo assíncrono.
- `MDFeRecepcaoEvento` — encerramento (`110112`) e cancelamento (`110111`), com o evento cru; só o
  RecepcaoSinc compacta.
- `MDFeStatusServico` — usado por `testConnection`.

Nenhum serviço do MDF-e leva SOAP Header: não existe `mdfeCabecMsg` no WSDL 3.00.

`close()` entra na interface para o encerramento, que não tem equivalente no CT-e — enquanto o
manifesto não é encerrado ele segue em aberto e trava o veículo para novos manifestos. Tanto o
encerramento quanto o cancelamento devolvem o `procEventoMDFe` (evento assinado + `retEventoMDFe`)
em `xmlEvento`, seguindo o que o CT-e passou a fazer no cancelamento.

`versaoModal` é atributo obrigatório do `<infModal>` — a SEFAZ rejeita com `cStat` 215 sem ele; há
teste de contrato fixando essa rejeição.

O harness de homologação ganhou `bun run test:mdfe`, que exercita build, assinatura XML-DSig,
`testConnection` e — com `FISCAL_MDFE_CHAVE_CTE` apontando para um CT-e já autorizado — emissão e
encerramento reais contra a SVRS.
