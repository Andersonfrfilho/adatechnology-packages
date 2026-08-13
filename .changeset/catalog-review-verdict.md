---
'@adatechnology/catalog-module': minor
---

`recordMetaReviewVerdict`: aplica o veredito da revisão da Meta que chega pelo webhook de catálogo.

A publicação devolve 200 muito antes de o item ser aprovado — a revisão é assíncrona. Sem esta
porta, um produto reprovado dias depois continuava marcado como `synced`, e o operador só
descobria pelo pedido que não chegava. O veredito só entra: nada é reenviado para a Meta, porque
a nossa republicação viraria um novo evento e o eco não teria fim.

Reprovação sai como `failed`, não como `pending`: reenviar o mesmo conteúdo seria reprovado de
novo. O `retryFailedSyncs` republica depois que o operador corrigir o item.
