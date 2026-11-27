ALTER TABLE "user"."users" ADD COLUMN "email_verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "user"."users" ADD COLUMN "phone" varchar(20);--> statement-breakpoint
ALTER TABLE "user"."users" ADD COLUMN "phone_verified_at" timestamp with time zone;--> statement-breakpoint
CREATE TABLE "user"."account_challenges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" uuid NOT NULL,
	"kind" varchar(32) NOT NULL,
	"secret_hash" varchar(64) NOT NULL,
	"target" varchar(320) NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX "idx_users_company_phone" ON "user"."users" USING btree ("company_id","audience","phone") WHERE "user"."users"."phone" is not null and "user"."users"."company_id" is not null and "user"."users"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_users_phone_single_tenant" ON "user"."users" USING btree ("audience","phone") WHERE "user"."users"."phone" is not null and "user"."users"."company_id" is null and "user"."users"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "idx_account_challenges_user_kind" ON "user"."account_challenges" USING btree ("user_id","kind");--> statement-breakpoint
CREATE INDEX "idx_account_challenges_secret" ON "user"."account_challenges" USING btree ("kind","secret_hash");--> statement-breakpoint
ALTER TABLE "user"."account_challenges" ADD CONSTRAINT "account_challenges_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "user"."users"("id") ON DELETE cascade ON UPDATE no action;
