---
'@adatechnology/conversations-ui': patch
---

O painel de revisão do áudio gravado passa a usar o `AudioPlayer` do pacote em vez dos controles nativos do navegador, e sua largura acompanha a viewport. Os controles nativos traziam volume e menu que não cabiam em tela pequena, e a largura fixa sangrava para fora no celular.
