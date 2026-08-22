CREATE SCHEMA "user";
--> statement-breakpoint
CREATE TABLE "user"."password_reset_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"requested_ip" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user"."refresh_tokens" (
	"token_hash" varchar(64) PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user"."users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar(64),
	"email" varchar(320) NOT NULL,
	"name" varchar(160) NOT NULL,
	"password_hash" varchar(255),
	"role" varchar(40) NOT NULL,
	"provider_id" varchar(40) DEFAULT 'local' NOT NULL,
	"external_id" varchar(200),
	"is_active" boolean DEFAULT true NOT NULL,
	"last_seen_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user"."password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "user"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user"."refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "user"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_password_reset_tokens_hash" ON "user"."password_reset_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "idx_password_reset_tokens_user" ON "user"."password_reset_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_users_company_email" ON "user"."users" USING btree ("company_id","email") WHERE "user"."users"."company_id" is not null and "user"."users"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_users_email_single_tenant" ON "user"."users" USING btree ("email") WHERE "user"."users"."company_id" is null and "user"."users"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_users_company_provider_external" ON "user"."users" USING btree ("company_id","provider_id","external_id") WHERE "user"."users"."external_id" is not null and "user"."users"."company_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_users_provider_external_single_tenant" ON "user"."users" USING btree ("provider_id","external_id") WHERE "user"."users"."external_id" is not null and "user"."users"."company_id" is null;--> statement-breakpoint
CREATE INDEX "idx_users_company_active" ON "user"."users" USING btree ("company_id","is_active");