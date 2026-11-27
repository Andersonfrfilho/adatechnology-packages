ALTER TABLE "user"."users" ADD COLUMN "lock_level" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "user"."users" ADD COLUMN "last_failed_login_at" timestamp with time zone;--> statement-breakpoint
CREATE TABLE "user"."login_lockouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"partition" varchar(64) DEFAULT '' NOT NULL,
	"scope" varchar(40) NOT NULL,
	"identifier_hash" varchar(64) NOT NULL,
	"failures" integer DEFAULT 0 NOT NULL,
	"lock_level" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"last_failure_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX "login_lockouts_subject_unique" ON "user"."login_lockouts" USING btree ("partition","scope","identifier_hash");
