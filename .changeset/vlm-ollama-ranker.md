---
'@adatechnology/product-vision-provider': minor
---

Desempate por modelo de visao, servido por Ollama local — o terceiro degrau da cascata.

`createOllamaRanker` entra em `createVisionChain(engines, { ranker })`. Sem ele a cadeia nao expoe
`rank` e o consumidor devolve os candidatos para a pessoa escolher, que continua sendo o
comportamento correto e instantaneo.

O modelo escolhe um NUMERO, nunca o id do produto: pedir UUID convida alucinacao — o modelo inventa
um id parecido, o consumidor nao acha na lista e a escolha se perde. O `0` e "nenhum destes", que e
o que impede o desempate de escolher o menos improvavel quando o cliente fotografou algo que a loja
nao vende. Um candidato so dispensa a inferencia inteira.

Medido em CPU (Apple Silicon, qwen2.5vl:3b): **5s a 15s por desempate**. E muito para uma conversa,
e o numero e o argumento mais forte para ligar isto so quando a metrica do vetorial justificar.

O default e `qwen2.5vl:3b` por ter sido o que respondeu: o `moondream`, metade do tamanho e a
escolha obvia, devolve string VAZIA no Ollama 0.32 ate com prompt so de texto — sintoma
indistinguivel de "o modelo nao soube responder". Ha teste de integracao afirmando que o modelo
default produz conteudo.

O teste de acoplamento passa a derivar os subpaths do `package.json` em vez de lista escrita a mao:
a lista fixa nao conhecia o engine adicionado hoje, e teria passado verde sem cobrir nada dele.
