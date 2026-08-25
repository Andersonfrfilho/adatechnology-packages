---
'@adatechnology/email-provider': minor
---

Os três drivers passam a enviar anexo.

O contrato trafega referência: o arquivo vive no storage e a URL assinada chega no `send`. **Quem
baixa é o driver**, e não o módulo — o módulo pode decidir não enviar (supressão, canal desligado,
preferência), e ter carregado 25MB para descobrir isso é desperdício de memória num processo que
atende outras entregas ao mesmo tempo.

`fetchAttachments` é comum aos três: valida pelo contrato **antes de qualquer rede**, baixa em
paralelo, e reprova pelo `content-length` antes de ler o corpo — sem isso, um objeto trocado no
storage entre a assinatura e o envio derrubaria o processo por memória em vez de reprovar a
entrega. O teto de 25MB vale também para a **soma**: dez anexos de 20MB passam um a um e produzem
uma mensagem de 200MB que nenhum provedor aceita.

Falha de anexo vira `retriable` com o motivo no `errorCode`, porque a causa é quase sempre
assinatura vencida ou storage fora do ar — as duas se resolvem numa nova tentativa, com assinatura
nova.

Por driver:

- **SMTP** — o nodemailer monta o MIME sozinho; basta entregar os bytes.
- **Resend** — o arquivo vai no próprio JSON, em base64. Não há upload separado.
- **SES** — `SendEmail` só aceita `Simple`, que **não tem campo de anexo**. Com anexo o caminho é
  `Raw`, e o MIME inteiro passa a ser nosso: `buildMimeMessage` monta `multipart/mixed` com um
  `multipart/alternative` **aninhado**. O aninhamento não é detalhe — no mesmo nível, o cliente
  trataria o anexo como uma terceira "versão alternativa" do corpo e poderia exibi-lo no lugar do
  texto. Assunto com acento sai em RFC 2047, base64 quebrado em 76 colunas, CRLF, e boundary
  aleatório por mensagem.

**Sem anexo o SES continua no `Simple`.** Não é otimização: o `Simple` deixa a AWS cuidar de
codificação de cabeçalho, quebra de linha e charset. Montar MIME quando não precisa é assumir esse
trabalho — e os bugs dele — em todo e-mail do produto, para servir a minoria que leva arquivo.
