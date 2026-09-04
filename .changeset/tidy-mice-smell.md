---
'@adatechnology/customer-contracts': minor
---

Telefone normaliza a máscara em vez de recusá-la, e `isPrimary` distingue ausente de `false`

`(16) 99305-6772` e `16993056772` passam a ser o mesmo número na fronteira. Recusar a máscara
obrigava cada tela a limpar antes de enviar, e a que esquecesse mandava o operador corrigir um
telefone que estava certo.

`isPrimary` em telefone e endereço vira opcional: com `default(false)`, "o primeiro da lista é o
primário" nunca acontecia, porque o valor chegava sempre definido.
