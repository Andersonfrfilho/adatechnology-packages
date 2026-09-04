-- Baseline CONVERGENTE.
--
-- Todo comando é condicional, e não por gosto: um baseline descreve o ESTADO desejado e pode
-- encontrar o banco em qualquer situação anterior a ele. Foi assim que o `notification-module@0.1.0`
-- derrubou a api de quem já era usuário — `CREATE SCHEMA` cru num banco que já tinha o schema.

CREATE SCHEMA IF NOT EXISTS "customer";
--> statement-breakpoint
-- Busca parcial (`ilike '%x%'`) não usa B-tree: o curinga à esquerda impede. Sem trigram, a
-- listagem vira varredura sequencial com o cadastro crescendo.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "customer"."customers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid,
  "name" varchar(255),
  "email" varchar(255),
  "birth_date" date,
  "attributes" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "external_user_id" uuid,
  "deleted_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "customer"."customer_phones" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "customer_id" uuid NOT NULL,
  "company_id" uuid,
  "number" varchar(20) NOT NULL,
  "label" varchar(60),
  "is_whatsapp" boolean DEFAULT false NOT NULL,
  "is_primary" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "customer"."customer_documents" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "customer_id" uuid NOT NULL,
  "company_id" uuid,
  "name" varchar(40) NOT NULL,
  "value" text NOT NULL,
  "fingerprint" varchar(64),
  "valid" boolean,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "customer"."customer_addresses" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "customer_id" uuid NOT NULL,
  "label" varchar(60),
  "zip_code" varchar(9),
  "street" varchar(255),
  "number" varchar(20),
  "complement" varchar(120),
  "district" varchar(120),
  "city" varchar(120),
  "state" varchar(2),
  "is_primary" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "customer"."settings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid,
  "mask_phone_in_list" boolean DEFAULT true NOT NULL,
  "document_catalog" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "field_catalog" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_by_user_id" uuid
);
--> statement-breakpoint
-- Postgres não tem ADD CONSTRAINT IF NOT EXISTS; o bloco anônimo é o idioma do próprio drizzle.
DO $$ BEGIN
 ALTER TABLE "customer"."customer_phones" ADD CONSTRAINT "customer_phones_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "customer"."customers"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer"."customer_documents" ADD CONSTRAINT "customer_documents_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "customer"."customers"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer"."customer_addresses" ADD CONSTRAINT "customer_addresses_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "customer"."customers"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
-- A IDENTIDADE DA CONVERSA. Parcial de propósito: dois clientes podem dividir o telefone fixo de
-- casa; nenhum divide o do WhatsApp. Se dividissem, a próxima mensagem cairia na ficha errada — sem
-- erro nenhum, só resposta para a pessoa errada.
--
-- NULLS NOT DISTINCT é OBRIGATÓRIO aqui, não um detalhe: em single-tenant `company_id` é NULO, e o
-- Postgres trata nulos como distintos por padrão. Sem a cláusula, o índice existe, parece correto e
-- NÃO IMPEDE NADA — dois clientes com o mesmo WhatsApp passam. Verificado contra Postgres: sem ela,
-- a inserção duplicada foi aceita.
CREATE UNIQUE INDEX IF NOT EXISTS "idx_customer_phones_whatsapp" ON "customer"."customer_phones" ("company_id","number") NULLS NOT DISTINCT WHERE "is_whatsapp";
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_customer_phones_customer" ON "customer"."customer_phones" ("customer_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_customer_phones_number_trgm" ON "customer"."customer_phones" USING gin ("number" gin_trgm_ops);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_customer_documents_customer" ON "customer"."customer_documents" ("customer_id");
--> statement-breakpoint
-- O índice cego: igualdade sobre dado cifrado, comparando a impressão e nunca o texto cifrado.
CREATE INDEX IF NOT EXISTS "idx_customer_documents_fingerprint" ON "customer"."customer_documents" ("name","fingerprint") WHERE "fingerprint" IS NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_customer_documents_value" ON "customer"."customer_documents" ("name","value") WHERE "fingerprint" IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_customer_addresses_customer" ON "customer"."customer_addresses" ("customer_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_customers_company_name" ON "customer"."customers" ("company_id","name") WHERE "deleted_at" IS NULL;
--> statement-breakpoint
-- Um índice para TODAS as chaves de `attributes`, inclusive as que ainda não existem.
CREATE INDEX IF NOT EXISTS "idx_customers_attributes" ON "customer"."customers" USING gin ("attributes" jsonb_path_ops);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_customers_name_trgm" ON "customer"."customers" USING gin ("name" gin_trgm_ops);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_customers_external_user" ON "customer"."customers" ("external_user_id") WHERE "external_user_id" IS NOT NULL;
--> statement-breakpoint
-- NULLS NOT DISTINCT: em single-tenant `company_id` é NULO, e sem esta cláusula o índice deixaria
-- passar N linhas nulas — várias configurações concorrendo, nenhuma sendo a verdadeira.
CREATE UNIQUE INDEX IF NOT EXISTS "idx_customer_settings_company" ON "customer"."settings" ("company_id") NULLS NOT DISTINCT;
