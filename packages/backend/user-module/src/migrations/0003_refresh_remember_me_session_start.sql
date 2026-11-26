ALTER TABLE "user"."refresh_tokens" ADD COLUMN IF NOT EXISTS "remember_me" boolean;--> statement-breakpoint
ALTER TABLE "user"."refresh_tokens" ADD COLUMN IF NOT EXISTS "session_started_at" timestamp with time zone DEFAULT now() NOT NULL;
