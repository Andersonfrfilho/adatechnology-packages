---
'@adatechnology/web-chat-widget': patch
---

Corrige a escala dos ícones e dos botões de opção no composer.

SVG sem dimensão herda 100% da caixa: microfone e enviar saíram do tamanho de ícone para o do
próprio botão de 44px. Agora o desenho tem tamanho próprio, e no desktop o par de círculos encolhe
para 38px — os 44px existem pela área de toque do dedo, que não vale para ponteiro.

Os botões de resposta rápida também baixaram um degrau, para não competirem com o texto da conversa.
