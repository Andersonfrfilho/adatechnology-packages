---
'@adatechnology/conversations-ui': minor
---

Workspace de conversas:

- `simulator.createTestContact` liga "Novo contato de teste": o simulador abre sem conversa selecionada, com o contato que o host devolve (`SimulatorTestContact`), pelo mesmo transporte por canal. Quando a conversa aparece na lista, ela é selecionada.
- `contextLabels` repassa rótulos (`title`, `empty`, `notCollected`...) ao painel de contexto embutido.
- Número de teste do simulador (só dígitos, começando com `0`) deixa de ser formatado como telefone e aparece como "Contato de teste 1234" (`isTestContactNumber`, `TEST_CONTACT_LABEL`). Telefones reais não mudam.

Tudo opcional: sem as props novas, a tela é a mesma de antes.
