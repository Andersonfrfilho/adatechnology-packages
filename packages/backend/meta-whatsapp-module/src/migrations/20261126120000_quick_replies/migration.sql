-- Respostas rápidas por empresa (atalho `/` do composer do atendente).
--
-- Aditiva: só cria tabela e índices novos, sem tocar em nada existente. O atalho é único por
-- empresa (não globalmente): duas empresas do mesmo host usam `/ola` sem se enxergar. A ordem é
-- `sort_order` e não o título, para quem edita decidir o que aparece primeiro no seletor.
CREATE TABLE IF NOT EXISTS "meta_whatsapp"."quick_replies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"title" varchar(40) NOT NULL,
	"shortcut" varchar(20) NOT NULL,
	"body" varchar(1000) NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_quick_replies_company_shortcut" ON "meta_whatsapp"."quick_replies" ("company_id","shortcut");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_quick_replies_company_order" ON "meta_whatsapp"."quick_replies" ("company_id","sort_order");
