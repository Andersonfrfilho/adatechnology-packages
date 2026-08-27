---
'@adatechnology/scheduling-ui': patch
---

Agenda com período, linha do agora e estados que dizem o que fazer

A agenda não dizia qual dia estava aberto: o cabeçalho tinha só o seletor de recurso e três
botões de navegação, e o operador descobria a semana contando as colunas. Ela ganha título do
período, colunas com linhas de hora, cabeçalho de dia fixo no scroll, destaque na coluna de hoje
e a linha vermelha do agora, com tique de um minuto. O bloco de reserva, que era uma caixa inerte
com o título, passa a mostrar o horário, a cor do status e a abrir o `BookingDrawer` no clique —
antes só a tabela de reservas chegava ao detalhe. Anterior/próximo viraram botões de ícone com
`aria-label` e dia/semana virou controle segmentado.

Vazio, carregando e falha saem de parágrafo solto em cinco arquivos para `EmptyState`,
`ListSkeleton` e `ErrorBanner`. O aviso de erro usava `bg-red-50` sem variante escura: no tema
escuro saía texto vermelho sobre fundo quase branco. Recursos e serviços vazios agora trazem o
botão de criar dentro do próprio estado vazio, e a disponibilidade explica que a regra é por
recurso em vez de mostrar um travessão.

Correção de layout: o `SidePanel` é `wide:static`, mas as áreas eram `flex-col` — acima de
1280px o painel de edição caía abaixo da lista em vez de virar coluna ao lado. As áreas passam a
ser linha com o conteúdo numa coluna interna.

Classes de botão, campo, superfície e zebra saem de cinco cópias divergentes para
`ui.constant.ts`, com `focus-visible` que nenhum botão da tela tinha; a cor de status das
reservas passa a vir de `BookingStatusBadge`, compartilhada entre a tabela e a agenda, e os
filtros de status viram chips no lugar de caixas de seleção nuas.
