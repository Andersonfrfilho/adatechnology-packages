---
"@adatechnology/conversations-ui": patch
---

Prévia do `WhatsAppMessageEditor` passa a se parecer com um balão real do WhatsApp.

Antes, a prévia de "Mensagem de boas-vindas" / "Mensagem de encerramento" (usada por
`WelcomeFarewellForm`/`MessagesWorkspace`) renderizava um balão branco alinhado à esquerda, como
se fosse uma mensagem recebida do cliente — mas essas mensagens são enviadas pela empresa. Trocado
para o mesmo padrão já usado em `WhatsAppCreateTemplateForm` (balão verde `#dcf8c6`/`#1b5e20`,
alinhado à direita, canto superior direito sem curva, com horário e check duplo), eliminando a
divergência visual entre as duas prévias do mesmo pacote.
