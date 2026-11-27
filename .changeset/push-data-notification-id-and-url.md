---
"@adatechnology/notification-module": minor
---

O push passa a levar `data` ao driver: `notificationId` (opaco) e `url`, o caminho relativo de `payload.link` quando existe (links externos ou protocolo-relativos são descartados). É o que permite ao service worker abrir o item certo ao clicar no aviso. Sem `link` no payload, nada muda além do `notificationId`.
