---
'@adatechnology/notification-ui': minor
---

Abas por canal, texto proprio para cada um, rolagem no preview e leitor de e-mail completo.

**Cada canal tem o proprio texto.** Os canais nao sao o mesmo recado em molduras diferentes: o
WhatsApp ignora o assunto, o SMS cobra por segmento de 160 e encurta, o push corta em duas linhas.
Antes um texto unico era copiado para todos, o que obrigava a escrever para o pior canal e mandar
isso a todo mundo. No banco cada canal ja era uma linha propria (`key`+`channel`+`locale`) — agora
a tela reflete isso.

**Abas em vez de blocos empilhados.** Com tres canais marcados, empilhado obriga a rolar por tres
aparelhos do e-mail para chegar ao WhatsApp. Cada aba tem o proprio editor e o proprio preview, e a
comparacao que importa — entre APARELHOS — continua lado a lado dentro da aba. A aba de um canal
sem texto leva um ponto: sem ele, o canal escondido bloquearia o salvar sem explicar por que.

**Rolagem como no aparelho.** O quadro tem altura de aparelho e o texto longo rola por dentro, com
a barra de acoes fixa no topo — nao o conteudo inteiro deslizando junto.

**Aparelho e leitor mais fieis.** Moldura fina com botoes laterais; no leitor de e-mail entram o
trilho de acoes, a barra de ferramentas com nove acoes, o contador de posicao, o rotulo da pasta, o
endereco do remetente e o link de cancelar inscricao. Sao convencoes que todo cliente compartilha —
nenhuma marca de terceiro e reproduzida, nem logotipo nem paleta.
