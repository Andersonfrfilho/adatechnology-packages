---
'@adatechnology/notification-ui': minor
---

Tela de mensagens: tabela e lista, editor de código no corpo de e-mail, e barra de formatação.

**Espaço.** O cartão da lista gastava 273px dos 668px em cabeçalho e filtros antes da primeira
mensagem, e a coluna do editor reservava 688px de largura para uma linha de 20px. Sem rascunho a
coluna do editor deixa de existir: a lista fica com a largura inteira e as mensagens viram grade de
cartões. O editor ganhou ritmo vertical único — ele dava padding lateral aos filhos e nada na
vertical.

**Tabela e lista.** Duas leituras da mesma coleção: a tabela alinha canal e versão em coluna para
comparar de relance, a lista mostra o texto em duas linhas para reconhecer. Cabeçalho com três
estados, `aria-sort`, zebra por CSS, e a linha inteira abre o template.

**Editor de código** no corpo de e-mail quando o texto tem marcação, por sobreposição em vez de
trazer um CodeMirror para um pacote de duas dependências. O realce devolve tokens e não string de
markup: montar `<span>` numa string e jogar em `dangerouslySetInnerHTML` faria o realce virar o
vetor de injeção do próprio texto que ele deveria só colorir.

**Barra de formatação** com a marcação do WhatsApp, única para todos os canais
(`conversation-flow.md` §4). O botão alterna em vez de acumular — a convenção não aninha — e a
seleção é reposta antes da pintura. Emoji em paleta curada de 24.

**Novos slots:** `validateEmailHtml` desenha o laudo do produto sob o campo, e o preview de e-mail
renderiza o HTML do campo num `<iframe sandbox="">` — sem script, sem mesma-origem, e o CSS do
e-mail não vaza para o painel.
