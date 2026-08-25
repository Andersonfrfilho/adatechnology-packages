---
'@adatechnology/user-ui': minor
---

Tela de equipe: `TeamWorkspace`, `TeamMemberForm` e `useTeam`.

O pacote cobria a conta de quem já está logado — entrar, esquecer a senha, editar o perfil. Não
havia nada para **administrar quem tem acesso**, e o `user-module` já expõe `CreateUserUseCase` e
`ListUsersUseCase` há tempo.

Listagem paginada, cadastro e ativar/desativar.

**Some inteira quando a `UserApi` não traz `listTeam`.** Os três métodos novos (`listTeam`,
`createTeamMember`, `setTeamMemberActive`) são **opcionais**: nem todo produto expõe as rotas de
admin, e vários não têm sequer a noção de equipe. Torná-los obrigatórios quebraria todo consumidor
atual e forçaria implementações vazias que lançam — pior que a capacidade não existir.

Os controles seguem a mesma regra, um nível abaixo: sem `createTeamMember` o botão de cadastro não
existe, e sem `setTeamMemberActive` a coluna de ação nem é desenhada. Botão que existe e falha no
clique é pior que botão ausente.

Dois detalhes que só aparecem em uso:

- `autocomplete="new-password"` no campo de senha, e **não** `off`. Com `off`, o gerenciador oferece
  a senha de **quem está logado** — e ela viraria a senha da pessoa nova, sem ninguém perceber.
- Depois de criar, a lista **recarrega** em vez de inserir a linha localmente: o servidor normaliza
  o e-mail, atribui o id e decide a ordem. Uma linha montada no cliente divergiria na primeira
  paginação.

A paginação só aparece com mais de uma página — controle inerte é ruído.
