CREATE TABLE "meta_whatsapp"."settings" (
	"company_id" uuid PRIMARY KEY,
	"template_name" varchar(128),
	"template_language" varchar(16) DEFAULT 'pt_BR' NOT NULL,
	"template_variables" jsonb DEFAULT '[]' NOT NULL,
	"welcome_message" text,
	"farewell_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
