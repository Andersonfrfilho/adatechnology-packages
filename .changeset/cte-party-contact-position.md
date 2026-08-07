---
"@adatechnology/fiscal-provider": patch
---

CT-e: `fone` e `email` saem de dentro do endereço do participante, e `xFant` fica só no remetente.

O leiaute do CT-e encerra `enderReme`/`enderDest`/`enderExped`/`enderReceb` em `UF`, seguido apenas
de `cPais` e `xPais`. O builder emitia `fone` e `email` ali dentro, e a SEFAZ recusava com
`215 Rejeição: Falha no schema XML` assim que qualquer um dos dois vinha preenchido — quem deixava
os campos vazios nunca esbarrou no defeito. Os dois passaram para onde o leiaute os coloca: `fone`
antes do bloco de endereço, `email` depois, ambos filhos diretos do participante.

`xFant` só existe no grupo `rem`. Emiti-lo em `dest`, `exped` ou `receb` derrubava o schema pelo
mesmo caminho, então agora ele é ignorado fora do remetente. Nenhuma mudança de tipo: quem já
preenchia `xFant` nesses participantes continua compilando, o campo apenas deixa de ir para o XML.

Conferido contra CT-es reais autorizados: `<xNome>`, `<xFant>`, `<fone>`, `<enderReme>`, `<email>`.
