CREATE TABLE "meta_whatsapp"."documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"message_id" uuid,
	"upload_id" varchar(256) NOT NULL,
	"filename" varchar(512) NOT NULL,
	"mime_type" varchar(128) NOT NULL,
	"size_bytes" integer NOT NULL,
	"sha256" varchar(64),
	"source" varchar(12) NOT NULL,
	"linked_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "meta_whatsapp"."documents" ADD CONSTRAINT "documents_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "meta_whatsapp"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meta_whatsapp"."documents" ADD CONSTRAINT "documents_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "meta_whatsapp"."messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_documents_session_linked" ON "meta_whatsapp"."documents" ("session_id","linked_at");--> statement-breakpoint
CREATE INDEX "idx_documents_company_linked" ON "meta_whatsapp"."documents" ("company_id","linked_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_documents_company_upload" ON "meta_whatsapp"."documents" ("company_id","upload_id");
