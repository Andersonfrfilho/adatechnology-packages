CREATE TABLE "meta_whatsapp"."flow_media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"flow_key" varchar(64) NOT NULL,
	"node_id" varchar(64) NOT NULL,
	"upload_id" varchar(256) NOT NULL,
	"filename" varchar(512) NOT NULL,
	"mime_type" varchar(128) NOT NULL,
	"size_bytes" integer NOT NULL,
	"caption" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_flow_media_node" ON "meta_whatsapp"."flow_media" ("company_id","flow_key","node_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_flow_media_node_upload" ON "meta_whatsapp"."flow_media" ("company_id","flow_key","node_id","upload_id");
