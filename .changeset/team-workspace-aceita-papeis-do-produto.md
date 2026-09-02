---
'@adatechnology/user-ui': minor
---

O `TeamWorkspace` aceita os papéis do produto, em vez de fixar `member` e `admin`

O `user-module` guarda `role` como string livre de propósito — há teste lá garantindo que nenhum
enum de papel saia do pacote, porque papel é vocabulário do PRODUTO. A tela de equipe contradizia
isso: o `<select>` de cadastro e o de edição ofereciam dois valores fixos, e o badge da listagem
decidia o rótulo por `role === 'admin'`. Um host com separador, atendente e motorista não conseguia
cadastrar ninguém pela tela, embora o servidor aceitasse os três sem reclamar.

`TeamWorkspace`, `TeamMemberForm` e `TeamMemberEditForm` passam a receber `roles: TeamRoleOption[]`
(`{ value, label, tone? }`). Sem a prop, `buildDefaultTeamRoles(labels)` reproduz exatamente o par
de antes, com os mesmos rótulos traduzíveis e o mesmo destaque no admin — nenhum consumidor atual
muda de comportamento.

Duas decisões que valem por si:

- **Papel desconhecido não some da listagem.** `resolveTeamRole` cai no valor cru como rótulo quando
  o papel não está na lista. Esconder a linha tiraria da tela justamente quem tem acesso que o host
  não sabe explicar.
- **A edição inclui o papel atual mesmo fora da lista** (`withCurrentRole`). Sem isso o `<select>`
  abriria já marcando outra opção, e salvar só o NOME de alguém o rebaixaria em silêncio, sem
  ninguém ter tocado no campo de papel.
