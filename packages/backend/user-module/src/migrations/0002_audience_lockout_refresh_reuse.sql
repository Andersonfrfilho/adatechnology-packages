ALTER TABLE "user"."users" ADD COLUMN "audience" varchar(64) DEFAULT 'default' NOT NULL;--> statement-breakpoint
ALTER TABLE "user"."users" ADD COLUMN "failed_login_attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "user"."users" ADD COLUMN "locked_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "user"."refresh_tokens" ADD COLUMN "revoked_at" timestamp with time zone;--> statement-breakpoint
DROP INDEX "user"."idx_users_company_email";--> statement-breakpoint
DROP INDEX "user"."idx_users_email_single_tenant";--> statement-breakpoint
DROP INDEX "user"."idx_users_company_provider_external";--> statement-breakpoint
DROP INDEX "user"."idx_users_provider_external_single_tenant";--> statement-breakpoint
CREATE UNIQUE INDEX "idx_users_company_email" ON "user"."users" USING btree ("company_id","audience","email") WHERE "user"."users"."company_id" is not null and "user"."users"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_users_email_single_tenant" ON "user"."users" USING btree ("audience","email") WHERE "user"."users"."company_id" is null and "user"."users"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_users_company_provider_external" ON "user"."users" USING btree ("company_id","audience","provider_id","external_id") WHERE "user"."users"."external_id" is not null and "user"."users"."company_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_users_provider_external_single_tenant" ON "user"."users" USING btree ("audience","provider_id","external_id") WHERE "user"."users"."external_id" is not null and "user"."users"."company_id" is null;
