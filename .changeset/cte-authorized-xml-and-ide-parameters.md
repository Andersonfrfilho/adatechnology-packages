---
'@adatechnology/fiscal-provider': minor
---

CT-e: devolve o XML autorizado (`cteProc`) e torna parametrizáveis os campos que hoje eram fixos

O `SefazCteProvider.emit` devolvia apenas `chaveAcesso` e `protocolo`. Sem o `cteProc` — o CT-e
assinado somado ao `protCTe` da SEFAZ — não existe documento fiscal para guardar, e a guarda do XML
autorizado é obrigação legal do emitente. `parseCteAutorizacaoResponse` passa a extrair o `protCTe`
cru da resposta (`xmlProtocolo`, mesmo mecanismo já usado na NF-e) e o provider monta o `cteProc`,
devolvido em `xmlAutorizado`. O resultado também passa a carregar `serie` e `numeroDocumento`, como
o provider de NF-e já fazia.

O `CteXmlBuilder` cravava `<retira>0</retira>` e `<indIEToma>9</indIEToma>` no `ide`, e não emitia
`vCargaAverb` nem o `dPrev` do `infNFe`. Nenhum dos quatro é constante: `retira` depende de o
recebedor buscar a carga no porto/aeroporto/filial, `indIEToma` depende da inscrição estadual do
tomador, `vCargaAverb` é o valor averbado da carga e `dPrev` é a data prevista de entrega da NF-e
referenciada. Todos passam a vir do `CteData`, com `xDetRetira` opcional no lugar certo do schema.

O padrão de `retira` muda de `'0'` para `'1'`: `'0'` significa que o recebedor retira no terminal, o
que é a exceção — a entrega no endereço do destinatário é o caso normal. Quem dependia do valor
antigo precisa passar `retira: '0'` explicitamente.
