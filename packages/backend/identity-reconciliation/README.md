# @adatechnology/identity-reconciliation

Regras puras que casam a base de usuários de um produto com o realm de um provedor de identidade.
Sem rede, sem banco, sem dependência: quem chama lê os dois lados e entrega nesta forma.

## O contrato de vínculo

Cada produto extrai o dele — coluna de perfil, contato de convite, atributo do realm — e entrega:

```ts
type LocalIdentityRecord = {
  id: string          // o identificador da pessoa no produto; volta no resultado
  document: string    // índice único: a pessoa tem um só
  emails: string[]    // conjunto: a mesma pessoa costuma ter mais de um
  subject?: string    // o `sub` do provedor, quando o produto já o gravou
}

type RealmIdentityRecord = { subject: string; document: string; emails: string[] }
```

O tipo é pobre de propósito. Canal, papel, situação e vocabulário de domínio ficam no produto:
o que entra aqui passa a valer para todos os que consomem o pacote.

## Os três degraus, nesta ordem

1. **`subject`** — identidade, não palpite: alguém o gravou quando as duas contas nasceram juntas.
2. **documento** — índice único da pessoa. Vem **antes** do e-mail, e é o que decide quando as duas
   metades discordam. Normalizado sem máscara e em caixa alta, então serve a CPF, CNPJ alfanumérico,
   NIF ou VAT sem o pacote conhecer nenhum deles.
3. **e-mail** — por **interseção de conjuntos**: basta um endereço em comum, em qualquer posição.
   O resultado diz **qual** endereço casou, que é o que poupa a investigação depois.

Casar por e-mail antes do documento faria a mesma pessoa aparecer duas vezes sempre que os dois
lados guardassem endereços diferentes — e é o caso comum, não a exceção.

## O que nunca casa

- **Chave em branco com chave em branco.** Duas pessoas sem documento cadastrado não são a mesma
  pessoa, e tratá-las como uma esconde uma das duas para sempre.
- **Duas pessoas na mesma conta.** Conta do provedor já reivindicada não é roubada por um degrau
  mais fraco: a segunda pessoa desce para o degrau seguinte, e sai como divergência se não casar.
- **Chave repetida no provedor.** Anomalia dele, não escolha nossa: o primeiro vence e o segundo
  aparece como divergência, em vez de sumir.

## Resultado

Cada linha sai como `linked`, `missing-in-realm` (tem vínculo no produto e não consegue entrar) ou
`missing-locally` (conta no provedor que ninguém no produto reivindica), com `matchedBy` dizendo
por qual degrau ela casou — a confiança é diferente em cada um, e quem decide o que fazer com a
divergência precisa saber disso.

## O que este pacote **não** faz

Ele não lê o provedor (use `@adatechnology/keycloak-admin`), não escreve nada, e **não faz login
funcionar com vários e-mails**: casar por um conjunto de endereços é reconciliação; autenticar por
qualquer um deles é configuração do realm — o Keycloak tem um campo `email` só, e endereço
alternativo exige atributo próprio mais um autenticador que o consulte.
