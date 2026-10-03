ALTER TABLE "meta_whatsapp"."messages" ADD COLUMN "transcription_status" varchar(16);--> statement-breakpoint
ALTER TABLE "meta_whatsapp"."messages" ADD COLUMN "transcription_text" text;--> statement-breakpoint
ALTER TABLE "meta_whatsapp"."messages" ADD COLUMN "transcription_language" varchar(32);--> statement-breakpoint
ALTER TABLE "meta_whatsapp"."messages" ADD COLUMN "transcription_engine" varchar(32);--> statement-breakpoint
CREATE INDEX "idx_messages_transcription_pending" ON "meta_whatsapp"."messages" ("company_id","created_at") WHERE "transcription_status" = 'pending';
