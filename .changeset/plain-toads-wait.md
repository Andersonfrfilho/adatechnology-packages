---
'@adatechnology/customer-module': minor
---

Primeira versão: schema, migrations, repositórios, casos de uso e rotas do cadastro de clientes

O cadastro vive em `pgSchema` próprio, com journal de migration próprio, e o host injeta banco,
cifra e fila — o módulo não escolhe nenhum dos três.

Telefone, endereço e documento são coleções, e a identidade no canal é o número de WhatsApp: um
índice único parcial com `NULLS NOT DISTINCT` garante que ele pertence a um cliente só, porque
entre consultar e gravar cabe outra escrita e duas mensagens do mesmo número chegam juntas.

Documento fica em tabela e não em jsonb, para virar índice; quando o produto o declara cifrado, o
valor cru não chega ao banco e a busca acontece por impressão (índice cego).

Capacidade por ausência em toda parte: declarar documento cifrado sem plugar a cifra falha no BOOT,
e produto que só lê o cadastro não publica rota de escrita.
