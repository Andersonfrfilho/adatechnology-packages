---
'@adatechnology/scheduling-ui': patch
---

Campo de data e hora com salto rápido de ano

Os quatro `datetime-local` nativos (remarcação da reserva e exceções de disponibilidade) passam a
usar `DateTimeField`: ano, mês e dia em seletores separados, mais o campo de hora. Trocar o ano
vira um toque em vez de setinha, que é a operação de quem abre uma reserva antiga ou bloqueia
agenda no ano que vem.

O valor continua sendo o mesmo texto `YYYY-MM-DDTHH:mm`, então a conversão de fuso de
`datetimeLocal.util` não muda. O dia é aparado ao trocar de mês (31 de março → fevereiro vira o
último dia do mês, não estoura para março), e o ano do valor entra na lista mesmo fora da janela
em torno de hoje.
