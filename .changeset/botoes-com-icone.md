---
'@adatechnology/user-ui': minor
---

As acoes viram botoes com icone, no lugar de links sublinhados.

Editar e enviar redefinicao eram `<button>` com cara de link. Num grupo de acoes lado a lado o
sublinhado nao distingue nada — e o ganho do icone e maior justamente onde ha varios controles
juntos, que e a situacao dessa celula.

Icones da biblioteca (`lucide-react`), nunca emoji: emoji renderiza diferente em cada sistema
operacional, nao herda `currentColor` e nao acompanha o token de tipografia.

O icone acompanha o rotulo e nunca o substitui, e vai como `aria-hidden` — o texto ao lado ja diz a
acao, e anunciar duas vezes atrapalha quem ouve. As acoes de linha ganham `aria-label` com o nome da
pessoa, porque a tabela repete o mesmo rotulo em toda linha.

`Cancelar` continua sem icone: num par com o primario, o secundario fica limpo. Acao destrutiva leva
icone por regra — ele reforca o peso antes do clique.
