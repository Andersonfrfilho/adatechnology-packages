---
'@adatechnology/product-vision-provider': patch
'@adatechnology/catalog-module': patch
---

Corta o custo do desempate, com os numeros medidos.

Medido em CPU (qwen2.5vl:3b), imagem sempre nova para nao pegar cache de prompt: modelo frio 16,3s,
quente 4,2s. Quase todo o tempo e prefill da imagem — a geracao leva ~22ms, porque a resposta sao
dois tokens.

`keep_alive` de 30 minutos e a maior economia isolada: 16,3s contra 4,2s. O default do Ollama e 5
minutos e o desempate e esporadico, entao quase toda foto pagava o carregamento.

`prepareImage` encolhe a foto antes de enviar: 1280px custa 1632 tokens e 6,6s; 896px cai para 1104
e 4,2s. Abaixo de 896px NAO adianta — o modelo normaliza, e 224px leva o mesmo tempo que 640px.
Limitar `num_predict` tambem nao adianta: a saida ja sao 2 tokens.

E a economia que zera o custo em vez de reduzi-lo: o `catalog-module` passa a pular o desempate
quando o primeiro candidato vence com folga (score >= 0,92 e margem >= 0,08 sobre o segundo). A
margem importa tanto quanto o score — itens irmaos pontuam alto E parecido, e e ai que a segunda
opiniao ganha o tempo dela de volta.
