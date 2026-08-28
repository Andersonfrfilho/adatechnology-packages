---
'@adatechnology/document-intake': minor
---

`readCcmei` — o mapa de rótulos do CCMEI — passa a viver aqui.

O critério para estar no pacote é **duas apps lerem o mesmo documento**: a landing lê no navegador
de quem anexa, e a API lê o arquivo que chegou ao bucket. O mapa do CRLV continua no painel
justamente porque só o painel lê CRLV.

O que **não** veio junto é o que decide o que fazer com a leitura: encaixar no formulário e comparar
com o que a pessoa digitou são assunto de quem tem formulário. A biblioteca extrai; o app decide.

Duas regras seguem dentro da extração, porque são do documento e não da tela: a data sai em ISO
(a Receita devolve assim, o CCMEI imprime `dd/mm/aaaa`, e sem converter a comparação seria entre
formatos) e CNPJ que não fecha o dígito verificador vira ausência com motivo, nunca valor.

Os oito contratos vieram junto e passam contra um PDF sintético com camada de texto de verdade.
