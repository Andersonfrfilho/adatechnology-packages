---
'@adatechnology/products-ui': patch
---

Exporta `removeBackground`, `BACKGROUND_FILL` e os tipos do recorte de fundo.

O componente já usava tudo isso internamente; expor permite acionar o mesmo recorte fora do
`ImageUpload` — e é o que torna o pipeline testável ponta a ponta num navegador real, em vez de só
pelo caminho da tela.
