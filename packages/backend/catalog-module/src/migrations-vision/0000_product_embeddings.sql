-- Migration da busca visual, separada do journal principal de propósito.
--
-- `vector` não é contrib do Postgres: exige a imagem pgvector/pgvector ou instalação do DBA.
-- Se esta linha estivesse na migration principal, todo consumidor do catalog-module — inclusive
-- quem nunca vai buscar produto por foto — deixaria de subir num Postgres sem a extensão.
-- Aqui, só o host que liga a visão chama `runCatalogVisionMigrations`.
CREATE EXTENSION IF NOT EXISTS vector;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "catalog"."product_embeddings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"model" varchar(64) NOT NULL,
	"source" varchar(16) NOT NULL,
	"embedding" vector(512) NOT NULL,
	"source_key" varchar(512) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "catalog"."product_embeddings" ADD CONSTRAINT "product_embeddings_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "catalog"."products"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_product_embeddings_product_model_source" ON "catalog"."product_embeddings" USING btree ("product_id","model","source");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_product_embeddings_hnsw" ON "catalog"."product_embeddings" USING hnsw ("embedding" vector_cosine_ops);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_product_embeddings_company" ON "catalog"."product_embeddings" USING btree ("company_id","model");
