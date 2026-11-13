-- `gin_trgm_ops` (índice de busca por nome de produto) não existe sem esta extensão, e o
-- drizzle-kit não a gera a partir do schema. Sem ela a migration falha com
-- "operator class gin_trgm_ops does not exist".
-- Em Postgres gerenciado (RDS, Cloud SQL) pg_trgm está na allowlist e o owner do banco
-- consegue criá-la; em instalação restrita, um DBA precisa rodar esta linha antes.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
--> statement-breakpoint
CREATE SCHEMA "catalog";
--> statement-breakpoint
CREATE TABLE "catalog"."catalogs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" varchar(120) NOT NULL,
	"description" text,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"external_id" varchar(128),
	"sync_status" varchar(12),
	"sync_error" varchar(512),
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "catalog"."products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"catalog_id" uuid,
	"section_id" uuid,
	"name" varchar(160) NOT NULL,
	"description" text,
	"price_in_cents" integer NOT NULL,
	"cost_price_in_cents" integer,
	"unit" varchar(16),
	"barcode" varchar(14),
	"image_url" text,
	"image_storage_key" text,
	"inventory" integer,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"availability" varchar(16) DEFAULT 'in stock' NOT NULL,
	"preparation_time_minutes" integer,
	"preparation_instructions" text,
	"external_id" varchar(128),
	"sync_status" varchar(12),
	"sync_error" varchar(512),
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "catalog"."sections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" varchar(80) NOT NULL,
	"catalog_id" uuid,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "catalog"."products" ADD CONSTRAINT "products_catalog_id_catalogs_id_fk" FOREIGN KEY ("catalog_id") REFERENCES "catalog"."catalogs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog"."products" ADD CONSTRAINT "products_section_id_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "catalog"."sections"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog"."sections" ADD CONSTRAINT "sections_catalog_id_catalogs_id_fk" FOREIGN KEY ("catalog_id") REFERENCES "catalog"."catalogs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_catalogs_company_name" ON "catalog"."catalogs" USING btree ("company_id","name") WHERE "catalog"."catalogs"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "idx_catalogs_company_active" ON "catalog"."catalogs" USING btree ("company_id","active","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_products_company_barcode" ON "catalog"."products" USING btree ("company_id","barcode") WHERE "catalog"."products"."barcode" is not null and "catalog"."products"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "idx_products_company_catalog" ON "catalog"."products" USING btree ("company_id","catalog_id","sort_order");--> statement-breakpoint
CREATE INDEX "idx_products_company_sync" ON "catalog"."products" USING btree ("company_id","sync_status");--> statement-breakpoint
CREATE INDEX "idx_products_name_trgm" ON "catalog"."products" USING gin ("name" gin_trgm_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "idx_sections_company_catalog_name" ON "catalog"."sections" USING btree ("company_id","catalog_id","name");