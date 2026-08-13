---
'@adatechnology/products-ui': minor
---

`ImageUpload` ganha remoção de fundo da foto do produto, rodando no navegador.

Ativado por ausência: sem `config.backgroundRemoval.modelUrl` o botão não é desenhado, e nada do
runtime de inferência é baixado.

Decisões de licença, que são o motivo de o código ser explícito em vez de uma chamada de biblioteca:

- **`@imgly/background-removal` está fora: é AGPL-3.0.** Copyleft de rede contamina um painel
  proprietário servido por HTTP.
- **RMBG-1.4 está fora: é Creative Commons não-comercial**, e exige acordo com a BRIA para uso
  comercial — catálogo de cliente pagante é uso comercial.
- Ficou **U²-Net (Apache-2.0)** sobre **`onnxruntime-web` (MIT)**, com o pré e pós-processamento
  aqui: normalização ImageNet, esticar min–max a máscara (sem isso ela sai lavada) e compor via
  `destination-in`. Evitar a variante `u2net_portrait`, treinada em dataset não-comercial.

Decisões de produto:

- **O recorte nunca é aplicado sozinho.** O modelo às vezes come a alça da bolsa; o resultado fica
  ao lado do original até alguém aprovar.
- **Fundo branco é o padrão**, com transparência como opção: o catálogo da Meta renderiza sobre
  claro ou escuro conforme o tema do WhatsApp, e produto escuro sobre transparência some no escuro.
- **O modelo não vem no pacote.** São alguns MB que não cabem no `install` de quem não usa o
  recurso; o host serve o `.onnx` do próprio domínio, o que também mantém a foto e o CSP em casa.
- `onnxruntime-web` é peer **opcional**, carregado por `import()` dinâmico no clique.
