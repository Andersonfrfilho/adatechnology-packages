---
"@adatechnology/site-preview-ui": minor
---

Pacote novo: prévia ao vivo do site dentro do painel. Lado do painel (`SitePreview`, `useSitePreviewChannel`, `usePreviewPan`): iframe em escala com Computador/Tablet/Celular, zoom, mão, Expandir e tela cheia, coluna fixa e rolagem guardada entre recargas. Lado do site (`createPreviewGuest`, subpath `./guest`, sem React): seções por chave (`data-preview-field`), destaque e rolagem até a seção em edição (só quando ela não cabe na janela), pedido de recarga de dados sem recarregar a página (foto nova) e restauração da rolagem. Protocolo `postMessage` versionado e validado nos dois lados.
