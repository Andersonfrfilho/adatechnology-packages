---
'@adatechnology/meta-whatsapp-provider': patch
---

Restaura `createWhatsAppProvider` e o tipo `WhatsAppProvider`, e re-exporta as
classes de erro.

A factory existia em `@adatechnology/whatsapp-provider` e se perdeu na
reorganização dos providers Meta — foi removida junto com o diretório antigo
sem ser portada, quebrando quem já a consumia (o QuickCart importa
`createWhatsAppProvider` na API e no worker).

Diferença em relação à versão antiga: não expõe mais `catalog`. Catálogo é
Meta Commerce, não WhatsApp, e agora vive em
`@adatechnology/meta-catalog-provider`; quem precisa dos dois compõe no host,
sem arrastar catálogo para quem só envia mensagem.

Os erros (`WhatsAppConfigError`, `WhatsAppConnectionError`,
`WhatsAppTimeoutError`, `WhatsAppWindowExpiredError`, etc.) passam a ser
re-exportados daqui. Eles moram em `meta-graph-core` por serem comuns a
qualquer API da Meta, mas exigir um segundo pacote só para escrever um `catch`
dos erros que este pacote lança vazaria organização interna na API pública.
