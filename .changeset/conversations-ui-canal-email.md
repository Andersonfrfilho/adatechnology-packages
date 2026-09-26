---
'@adatechnology/conversations-ui': minor
---

A tela ganha o canal `email` e passa a **obedecer à capacidade do canal**, lida do
`@adatechnology/conversation-contracts` em vez de declarada aqui.

Antes o pacote tinha a própria tabela de capacidades (`hasSessionWindow`, `windowHours`), o que dava
duas verdades sobre o que um canal sabe fazer: a do backend e a da tela. Agora `channelCapabilityFor`
devolve o objeto do contrato para os canais que ele descreve (`email`, `whatsapp`, `webchat`), e os
canais da Meta que a UI já servia (`messenger`, `instagram`) caem num padrão documentado enquanto o
contrato não os descrever.

Com isso a tela deixa de fingir: recurso que o canal não tem aparece **desabilitado com a dica
dizendo por quê** (anunciada por `aria-describedby`, não só `title`), e o selo de "lida" não aparece
em canal que não confirma leitura — o `email` é o primeiro caso, porque a única forma de saber seria
pixel de rastreio, que é impreciso e rastreia quem recebe sem essa pessoa saber.
