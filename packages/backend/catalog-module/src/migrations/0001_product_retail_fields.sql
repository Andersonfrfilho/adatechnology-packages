-- Campos de varejo físico: marca, embalagem, corredor e apelidos. Todos aditivos.
--
-- `aliases` nasce como array vazio e NOT NULL, e não como nulo: a busca faz `&&` sobre a coluna, e
-- `NULL && ARRAY[...]` devolve NULL em vez de falso — o produto sumiria do resultado inteiro, em
-- vez de apenas não casar pelo apelido.
--
-- Escrita à mão porque `drizzle-kit generate` está quebrado neste repositório ("This version of
-- drizzle-kit is outdated"), o que já acontecia antes desta mudança. O snapshot 0001 foi montado
-- junto, para o próximo `generate` não reemitir estas colunas quando a ferramenta voltar.
ALTER TABLE "catalog"."products" ADD COLUMN IF NOT EXISTS "unit_size" varchar(40);--> statement-breakpoint
ALTER TABLE "catalog"."products" ADD COLUMN IF NOT EXISTS "brand" varchar(80);--> statement-breakpoint
ALTER TABLE "catalog"."products" ADD COLUMN IF NOT EXISTS "aisle" varchar(60);--> statement-breakpoint
ALTER TABLE "catalog"."products" ADD COLUMN IF NOT EXISTS "aliases" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_products_brand_trgm" ON "catalog"."products" USING gin ("brand" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_products_aliases_gin" ON "catalog"."products" USING gin ("aliases");
