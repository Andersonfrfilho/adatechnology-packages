---
"@adatechnology/conversations-ui": patch
---

`ConversationWallpaper` desenha o próprio fundo, claro e escuro, sem depender do `styles.css`.

O fundo vivia só na folha de estilo do pacote, um import opcional: quem esquecia de fazê-lo via a
conversa sobre branco liso, sem erro nenhum denunciando o problema. Fundo é identidade do
componente, não tema do host.

O tema segue a classe `dark` do host via `useIsDarkTheme` — leitura passiva, sem escrever nada. A
prop `style` permite ao produto sobrescrever o fundo, e a classe `cv-wallpaper` segue no elemento
para quem já sobrescreve por CSS.
