---
'@adatechnology/document-intake': minor
---

Leitura de documento brasileiro pela camada de texto do PDF, no navegador de quem enviou o arquivo.

O código sai de `frontend-transportada`, onde já roda em produção, e vem para cá byte a byte: leitura
da camada de texto do pdf.js, geometria de rótulo (achar o valor abaixo do rótulo), identificação do
tipo de documento e dígitos verificadores de CPF, CNPJ, RENAVAM, placa, chassi e UF. Os 26 contratos
vieram junto.

O carregador do pdf.js **não** faz parte do pacote, de propósito. Ele é cola do bundler do app —
`import('pdfjs-dist/build/pdf.worker.min.mjs?url')` é sintaxe do Vite —, e é o app consumidor que
precisa emitir o worker na própria origem para satisfazer o `worker-src 'self'` da CSP dele. Um
pacote publicado não deve ser dono do contrato de CSP de quem o consome. Por isso `readPdfTextLayer`
recebe `getDocument` por parâmetro, o que também é o que mantém a camada testável fora do navegador.

O mapa de campos do CRLV fica no app: é domínio de quem cadastra frota, não desta biblioteca.
