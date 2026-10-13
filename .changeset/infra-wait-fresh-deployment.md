---
'@adatechnology/infra-module': patch
---

Desligar banco que reinicia sozinho: depois de trocar a política para "nunca" e fazer o redeploy, espera o deployment NOVO ficar de pé (id diferente do anterior e RUNNING) antes de parar. Antes o RUNNING do deployment antigo bastava, e o stop caía nos ids velhos sem tocar no novo. Se o novo não aparece no prazo, não para o antigo e a operação falha com `INFRA_SERVICE_STILL_RUNNING`.
