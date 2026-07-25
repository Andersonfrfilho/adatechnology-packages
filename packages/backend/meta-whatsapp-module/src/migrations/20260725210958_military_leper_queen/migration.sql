CREATE TABLE "meta_whatsapp"."flow_graphs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"company_id" uuid NOT NULL,
	"key" varchar(64) NOT NULL,
	"label" varchar(120) NOT NULL,
	"start_node_id" varchar(64) NOT NULL,
	"nodes" jsonb DEFAULT '{}' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"show_in_menu" boolean DEFAULT false NOT NULL,
	"menu_option_label" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "idx_flow_graphs_company_key" ON "meta_whatsapp"."flow_graphs" ("company_id","key");