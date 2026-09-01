-- Campos de varejo, todos opcionais: nenhum consumidor existente precisa preencher, e o default
-- de `aliases` mantem a coluna NOT NULL sem exigir backfill.
ALTER TABLE "catalog"."products" ADD COLUMN IF NOT EXISTS "brand" varchar(80);--> statement-breakpoint
ALTER TABLE "catalog"."products" ADD COLUMN IF NOT EXISTS "unit_size" varchar(24);--> statement-breakpoint
ALTER TABLE "catalog"."products" ADD COLUMN IF NOT EXISTS "aisle" varchar(60);--> statement-breakpoint
ALTER TABLE "catalog"."products" ADD COLUMN IF NOT EXISTS "aliases" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
-- A busca por texto passa a cobrir marca e apelido. Sem estes indices, procurar "guarana" ou
-- "tio joao" varre a tabela inteira — que e exatamente o caso de uso que os campos criam.
CREATE INDEX IF NOT EXISTS "idx_products_brand_trgm" ON "catalog"."products" USING gin ("brand" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_products_aliases" ON "catalog"."products" USING gin ("aliases");
