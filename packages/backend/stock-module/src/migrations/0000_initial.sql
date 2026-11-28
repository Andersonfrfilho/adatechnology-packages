CREATE SCHEMA IF NOT EXISTS "stock";
--> statement-breakpoint
CREATE TABLE "stock"."batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"ingredient_id" uuid NOT NULL,
	"batch_code" varchar(100) NOT NULL,
	"unit" varchar(8) NOT NULL,
	"quantity" numeric(14, 4) NOT NULL,
	"remaining_quantity" numeric(14, 4) NOT NULL,
	"cost_per_unit" numeric(14, 4),
	"expires_at" timestamp with time zone,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "batches_quantity_positive" CHECK ("quantity" > 0),
	CONSTRAINT "batches_remaining_range" CHECK ("remaining_quantity" >= 0 and "remaining_quantity" <= "quantity")
);
--> statement-breakpoint
CREATE TABLE "stock"."deductions" (
	"company_id" uuid NOT NULL,
	"source_key" varchar(300) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "deductions_company_id_source_key_pk" PRIMARY KEY("company_id","source_key")
);
--> statement-breakpoint
CREATE TABLE "stock"."inventory_count_lines" (
	"count_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"ingredient_id" uuid NOT NULL,
	"unit" varchar(8) NOT NULL,
	"expected_quantity" numeric(14, 4) NOT NULL,
	"counted_quantity" numeric(14, 4),
	CONSTRAINT "inventory_count_lines_count_id_ingredient_id_pk" PRIMARY KEY("count_id","ingredient_id"),
	CONSTRAINT "inventory_lines_counted_not_negative" CHECK ("counted_quantity" is null or "counted_quantity" >= 0)
);
--> statement-breakpoint
CREATE TABLE "stock"."inventory_counts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"status" varchar(10) DEFAULT 'open' NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"actor_id" varchar(128),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"applied_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "stock"."levels" (
	"company_id" uuid NOT NULL,
	"ingredient_id" uuid NOT NULL,
	"unit" varchar(8) NOT NULL,
	"quantity" numeric(14, 4) DEFAULT '0' NOT NULL,
	"minimum_quantity" numeric(14, 4),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "levels_company_id_ingredient_id_pk" PRIMARY KEY("company_id","ingredient_id"),
	CONSTRAINT "levels_minimum_not_negative" CHECK ("minimum_quantity" is null or "minimum_quantity" >= 0)
);
--> statement-breakpoint
CREATE TABLE "stock"."movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"ingredient_id" uuid NOT NULL,
	"batch_id" uuid,
	"kind" varchar(10) NOT NULL,
	"delta" numeric(14, 4) NOT NULL,
	"unit" varchar(8) NOT NULL,
	"reason" varchar(255) NOT NULL,
	"actor_id" varchar(128),
	"source_key" varchar(300),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "movements_delta_not_zero" CHECK ("delta" <> 0)
);
--> statement-breakpoint
ALTER TABLE "stock"."inventory_count_lines" ADD CONSTRAINT "inventory_count_lines_count_id_inventory_counts_id_fk" FOREIGN KEY ("count_id") REFERENCES "stock"."inventory_counts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock"."movements" ADD CONSTRAINT "movements_batch_id_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "stock"."batches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_batches_ingredient_expiry" ON "stock"."batches" USING btree ("company_id","ingredient_id","expires_at");--> statement-breakpoint
CREATE INDEX "idx_batches_expiring" ON "stock"."batches" USING btree ("expires_at") WHERE "remaining_quantity" > 0 and "expires_at" is not null;--> statement-breakpoint
CREATE INDEX "idx_inventory_counts_company_created" ON "stock"."inventory_counts" USING btree ("company_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_inventory_counts_open" ON "stock"."inventory_counts" USING btree ("company_id") WHERE "status" = 'open';--> statement-breakpoint
CREATE INDEX "idx_movements_company_created" ON "stock"."movements" USING btree ("company_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_movements_ingredient_created" ON "stock"."movements" USING btree ("company_id","ingredient_id","created_at");