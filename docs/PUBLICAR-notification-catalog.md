# Publicar o trio de notificações e o de catálogo

Os pacotes estão prontos e verificados; falta a publicação, que **não foi feita** por dois
bloqueios. Este documento existe para a publicação não depender de reconstruir o raciocínio.

## Bloqueio 1 — não há sessão npm

`npm whoami` devolve `E401 Unauthorized`. Login é seu:

```bash
npm login
```

## Bloqueio 2 — 57 changesets pendentes, 23 pacotes

`changeset publish` **não publica só estes nove**. Os changesets acumulados no repositório
cobrem, entre outros, 21 de `conversations-ui`, 20 de `meta-whatsapp-module`, mais
`products-ui`, `fiscal-provider` e `audio-transcription-provider` — trabalho de outra sessão,
em voo, num branch não mergeado. Publicar tudo de uma vez para o npm **público** e
**irreversível** (versão publicada não se reusa) não é o que "publicar o trio" quer dizer.

Duas saídas:

**A. Publicar tudo (release do repositório).** Só faz sentido se todo o trabalho pendente
estiver pronto para sair — decisão de quem acompanha as outras frentes.

```bash
pnpm version:changeset && pnpm publish:changesets
```

**B. Publicar apenas os nove.** Mover os changesets alheios para fora, versionar, publicar,
devolver:

```bash
mkdir -p /tmp/changesets-em-espera
cd .changeset && ls *.md | grep -vE 'README|notification-trio|notification-module-http|catalog-trio' \
  | xargs -I{} mv {} /tmp/changesets-em-espera/ && cd ..
pnpm version:changeset
pnpm publish:changesets
mv /tmp/changesets-em-espera/*.md .changeset/
```

## Regra que não pode ser esquecida

**Publicar com `pnpm`, nunca com `npm`.** `npm pack`/`npm publish` deixam `workspace:*` literal
no `dependencies` do tarball, e todo install quebra com `EUNSUPPORTEDPROTOCOL`. O pnpm reescreve
para a versão real. O `changeset publish` usa o package manager do repositório, então os comandos
acima estão certos — o risco é publicar um pacote à mão.

## Estado verificado

Nove pacotes em `0.1.0-rc.0`, `license: MIT`, 245 testes verdes, `tsc` limpo, build emitindo,
`exports` todos resolvendo para arquivo existente, e tarball provado por instalação real em
diretório limpo (migrations resolvem, rotas montam).

## Depois de publicar

Fase 7 do `.specs/features/notification-trio/tasks.md`: apontar o quickcart para o `rc` e montar.
É lá que a métrica de **≤ 25 linhas de cola** — a tese do projeto — finalmente é medida, contra as
1.353 linhas atuais. O que a Fase 7 descobrir vira `rc+1`.
