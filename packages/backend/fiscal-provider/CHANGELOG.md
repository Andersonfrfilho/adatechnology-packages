# @adatechnology/fiscal-provider

## 0.0.2

### NF-e (modelo 55) — correções de schema SEFAZ PL009

- **`serie` sem zeros à esquerda**: schema rejeita `'001'`; builder agora converte para `'1'`
- **`<vDesc>` obrigatório**: era condicional ao desconto, agora sempre emitido como `0.00`
- **`<IE>` no emitente**: campo obrigatório no schema PL009 adicionado ao `buildEmitXml`
- **xNome homologação automático**: builder substitui o nome do destinatário pela string exigida pelo SEFAZ (`NF-E EMITIDA EM AMBIENTE DE HOMOLOGACAO...`) quando `tpAmb='2'`; elimina cStat 598
- **JSDoc nos types**: todos os campos de `FiscalItem`, `NfeConfig`, `NfeDestinatario`, `NfeData` e demais types documentados com exemplos e valores aceitos

### Códigos cStat resolvidos nesta versão

| cStat | Causa | Fix |
|-------|-------|-----|
| 225 | Falha schema: `serie` com zeros, `vDesc` ausente | NfeXmlBuilder corrigido |
| 502 | Id não corresponde à chave (mod 65 vs 55) | `buildChaveAcesso` chamado com `mod: '55'` |
| 598 | xNome destinatário errado em homologação | Substituição automática no builder |
| 209 | IE emitente inválida | IE real do cadastro SEFAZ obrigatória |

## 0.0.1

### Patch Changes

- Initial release: NFC-e (Focus NFe) and SAT-CF-e providers for Brazilian electronic fiscal documents
