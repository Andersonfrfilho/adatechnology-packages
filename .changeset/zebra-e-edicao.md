---
'@adatechnology/user-ui': minor
---

Tabela zebrada, acao de editar nome e papel, e coluna de acoes que aparece por acao existir.

A zebra faltava — regra de listagem que a tabela de mensagens ja cumpria e esta nao. Ela alterna
pelo indice da linha RENDERIZADA, e nao por id: com ordenacao ou filtro a ordem dos ids nao e a
ordem da tela, e a listra tem que acompanhar o olho.

Editar cobre nome e papel. E-mail fica de fora de proposito: e a identidade de login e aparece em
trilha de auditoria e em historico de conversa — troca-lo por um campo de formulario faria o passado
apontar para outra pessoa. Senha tambem nao: quem troca e o dono dela, pelo fluxo de redefinicao.
Salvar fica desabilitado enquanto nada mudou, para nao gravar uma linha de auditoria dizendo que algo
mudou quando nada mudou.

A coluna de acoes era condicionada a poder desativar, e o botao de editar teria nascido invisivel num
host que edita mas nao desativa. Agora ela existe se houver qualquer acao, e cada controle dentro
dela responde pela sua propria capacidade.
