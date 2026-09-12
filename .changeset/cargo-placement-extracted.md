---
'@adatechnology/cargo-placement': minor
---

Nasce `@adatechnology/cargo-placement`: o empacotador do baú (posicionamento em grade de 5 cm, apoio
de 80 %, escora lateral, fatias por parada), a planta (`resolveCargoLayout`), as camadas do plano
(`resolveCargoPlanLayers`) e o serviço decimal em `bigint` saem da API do TransportAdA sem mudar
nenhuma regra física. As dezessete suítes de contrato acompanham o código; as cargas reais medidas
ficam em `@adatechnology/cargo-placement/fixtures` para quem precisar exercitar o empacotador.
