---
'@adatechnology/user-ui': minor
---

A foto passa a ficar dentro da ficha de edicao, e nao mais escondida no clique do avatar da linha.

Trocar a foto era clicar na propria foto na tabela. Funcionava, e ninguem descobria: o unico sinal
era o cursor mudando ao passar por cima de um elemento de 36px, e "Editar" abria uma ficha com
e-mail, nome e papel — dando a entender que ali estava tudo que se edita da pessoa.

Agora "Editar" abre a ficha inteira, foto inclusive, e a foto na linha e so exibicao. Dois caminhos
para a mesma coisa nao somam: obrigam a descobrir o caminho escondido, e essa descoberta nao
acontece sozinha.

O recorte de fundo continua no mesmo lugar do fluxo — escolher o arquivo abre a revisao lado a lado,
agora dentro da ficha. `TeamMemberEditForm` recebe a foto por slot, e nao pronta: o formulario nao
conhece armazenamento nem recorte, e sem o slot (host sem bucket) a ficha simplesmente nao tem foto.
