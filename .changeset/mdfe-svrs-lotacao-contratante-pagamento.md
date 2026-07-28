---
'@adatechnology/fiscal-provider': minor
---

MDF-e 3.00: grupos exigidos pela SVRS em carga lotação

Autorização real na SVRS de homologação expôs quatro divergências do builder em relação ao
schema e às regras de negócio do MDF-e:

- `consStatServMDFe` aceita apenas `tpAmb` e `xServ`. A NF-e e o CT-e pedem `cUF` nesse
  serviço; o MDF-e não, porque a SVRS autoriza para o país inteiro — com `cUF` a resposta é
  `cStat 215`.
- `sendMdfeStatusServico` não checava `response.ok`, então um 403 (certificado não credenciado)
  virava "SEFAZ MDF-e fora do ar" e escondia a causa real.
- Novos grupos no modal rodoviário: `infContratante` dentro do `infANTT` (rejeição 578),
  `infPag` fechando o `infANTT` (rejeição 302) e `infLotacao` dentro do `prodPred`
  (rejeição 726).

Tipos novos: `MdfeContratante`, `MdfeLotacao`, `MdfePagamento`, `MdfeComponentePagamento`,
`MdfeParcelaPagamento`, `MdfeDadosBancarios`, `MdfeTipoComponentePagamento` e
`MdfeIndicadorPagamento`. `MdfeData` ganhou `contratantes` e `pagamentos`;
`produtoPredominante` ganhou `lotacao`.

`infBanc` é obrigatório dentro do `infPag` mesmo em pagamento à vista — por isso
`MdfePagamento.dadosBancarios` é obrigatório.
