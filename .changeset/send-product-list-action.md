---
'@adatechnology/meta-whatsapp-contracts': minor
'@adatechnology/meta-whatsapp-module': minor
---

Vitrine de produtos no chat: action `send_product_list`

O canal ganha a capacidade opcional `sendProductList`, e o interpretador de fluxo ganha a action
que a usa. O nó guarda **critério** (texto e filtro), nunca a lista de `retailerId` congelada — uma
lista congelada continuaria oferecendo o item esgotado, e item excluído faz a Meta recusar a
mensagem inteira. Só produto em estoque entra, cortado no teto de 30 itens.

A action só é registrada quando o host injeta `providers.catalog` **e** `config.catalogId`: sem
catálogo o `retailerId` não significa nada. Canal sem `sendProductList` não envia — capacidade por
ausência, sem flag.

Falha de envio vai para o novo hook `onFlowProductListError` em vez de propagar: vitrine que não
saiu não pode deixar o cliente parado num nó automático. O transcript guarda texto e contagem, e
não o preço de cada item — ele envelheceria errado no dia seguinte ao reajuste.
