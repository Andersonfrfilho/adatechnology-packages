---
'@adatechnology/image-cutout': minor
'@adatechnology/products-ui': patch
'@adatechnology/user-ui': minor
---

Recorte de fundo sai de `products-ui` para pacote proprio, e passa a servir a foto de perfil.

O recorte vivia dentro do pacote de catalogo. Para a foto de perfil usar o mesmo codigo havia duas
saidas ruins: `user-ui` dependendo do pacote inteiro de produtos — arrastando tabela, preco e
sincronizacao com a Meta para dentro da tela de usuarios — ou uma segunda copia do modelo, do
pre-processamento e do pos-processamento. `@adatechnology/image-cutout` e a terceira.

`products-ui` continua exportando `removeBackground` e `BACKGROUND_FILL`: quem ja importava de la nao
precisa saber que mudou de casa.

No `user-ui`, `AvatarPicker` mostra original e recorte lado a lado e **so envia o que a pessoa
escolheu**. Isso nao e cautela decorativa: o U2-Net busca o objeto saliente, nao rostos — a variante
`u2net_portrait`, que seria a certa, tem dataset nao-comercial e nao pode entrar em painel
proprietario. Numa foto de pessoa o resultado acerta com frequencia e come uma orelha de vez em
quando, e quem descobre isso nao pode ser o colega vendo o avatar na lista.

O previa vai sobre quadriculado, porque sem ele um recorte transparente sobre fundo branco fica
identico ao recorte com fundo branco, e escolher entre os dois botoes viraria adivinhacao.

`backgroundRemoval` ausente no `TeamWorkspace` desliga o recurso: o botao some, em vez de aparecer e
falhar. O modelo e o runtime continuam servidos pelo host — sao megabytes que nao cabem no
`npm install` de quem nem usa o recurso, e servir do proprio dominio mantem a foto e o CSP dentro de
casa.
