---
'@adatechnology/meta-whatsapp-contracts': minor
'@adatechnology/meta-whatsapp-module': minor
---

Mensagem de LOCALIZAÇÃO do WhatsApp (botão "Localização" do app do cliente) agora é reconhecida pelo webhook: novo `whatsAppLocationSchema` (latitude/longitude obrigatórias, dentro da faixa válida; `name`/`address`/`url` opcionais), campo `location` em `WhatsAppMessage`, e novo builder de teste `buildInboundLocationPayload`. O conteúdo gravado no transcript fica legível ("📍 Localização" + nome/endereço quando vierem), o payload guarda a coordenada para o host calcular taxa de entrega por distância, e a coordenada nunca é escrita em log de servidor.
