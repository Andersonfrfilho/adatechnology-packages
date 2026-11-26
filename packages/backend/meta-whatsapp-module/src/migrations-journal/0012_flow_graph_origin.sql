-- Origem do grafo de fluxo: `seed` (escrito pelo produto) ou `edited` (salvo por uma pessoa no editor).
--
-- Serve para o produto atualizar grafos semeados que ninguém editou quando o seed muda, sem apagar à mão.
-- Aditiva com default: grafo existente vira `edited` — sem como saber se alguém mexeu, o reseed nunca o
-- sobrescreve (o comportamento de antes: só apagar e recriar troca esses grafos).
ALTER TABLE meta_whatsapp.flow_graphs
  ADD COLUMN IF NOT EXISTS origin VARCHAR(16) NOT NULL DEFAULT 'edited';
--> statement-breakpoint
ALTER TABLE meta_whatsapp.flow_graphs
  ADD COLUMN IF NOT EXISTS seed_version VARCHAR(64);
