---
'@adatechnology/conversations-ui': patch
---

Simulador do cliente para de engolir falha ao ler o transcript.

O `refresh` tratava QUALQUER erro como "conversa ainda não existe": mostrava thread vazia e não dizia
nada. Com sessão ausente (401) o sintoma era o pior possível — a mensagem ia ao webhook, era aceita
com 200, o bot respondia, e a tela não mudava. Quem olhava concluía que o envio estava quebrado, e o
rastro levava a investigar assinatura de HMAC, que estava correta.

Agora só **404** vira transcript vazio, que é o primeiro contato de verdade. As outras falhas
aparecem em aviso próprio, separado do erro de envio (causas diferentes), e **sem limpar** o que já
está na tela — perder o histórico por um refresh que falhou é dano maior que o erro.

401/403 ganha texto específico, porque a causa é sempre a mesma e não é óbvia: token de admin vive em
`sessionStorage`, que é por aba, e link com `rel="noreferrer"` abre contexto que não herda esse token.
O aviso diz que a mensagem FOI entregue e o que fazer.

A classificação lê `status`/`statusCode` do erro de forma estrutural — o contrato não exige tipo de
erro, então host que joga `new Error(texto)` continua funcionando, caindo no texto genérico.
